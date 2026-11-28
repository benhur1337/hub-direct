import type Anthropic from "@anthropic-ai/sdk";
import { brandContext } from "./brand-profile";
import type { Project } from "./model";

export const calendarWeeks = 8;
export type CalendarEvent = { date: string; name: string; why: string; idea: string; fixed: boolean };

const text = { type: "string" } as const;
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "name", "why", "idea", "fixed"],
        properties: { date: { type: "string", format: "date" }, name: text, why: text, idea: text, fixed: { type: "boolean" } },
      },
    },
  },
};

/** Upcoming dates worth posting about, picked for the brand's market, industry and voice. */
export function calendarRequest(project: Project, from: string, language: string) {
  const context = brandContext(project, "");
  return {
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      `List 6 to 15 dates in the ${calendarWeeks} weeks starting ${from} that this brand could post about: public holidays and observances in its market, seasonal moments, and industry days. ` +
      "Pick only dates that suit the brand's audience and voice, and leave out any its rules would avoid. " +
      "For each give the date, its name, one sentence on why it fits this brand, and a one-sentence post idea in the brand's voice. " +
      "Set fixed to false when the date moves from year to year (lunar, religious or announced each year) or you are unsure of it. " +
      `Write name, why and idea in ${language}. ` +
      context.instruction,
    messages: [{ role: "user", content: JSON.stringify({ brandContext: context.data }) }],
  } satisfies Anthropic.Beta.MessageCreateParamsNonStreaming;
}

/** Keeps only well-formed events inside the requested range, in date order. */
export function readEvents(raw: string, from: string): CalendarEvent[] {
  const start = Date.parse(from);
  const end = start + calendarWeeks * 7 * 86400000;
  const events: unknown = JSON.parse(raw).events;
  if (!Array.isArray(events)) return [];
  const short = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "");
  return events
    .map((e) => ({ date: String(e?.date), name: short(e?.name, 120), why: short(e?.why, 400), idea: short(e?.idea, 400), fixed: e?.fixed === true }))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Date.parse(e.date) >= start && Date.parse(e.date) < end && e.name && e.idea)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 20);
}
