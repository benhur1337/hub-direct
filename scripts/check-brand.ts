import assert from "node:assert/strict";
import { brandContext, initialProfile, normalizeProfile } from "../lib/brand-profile";
import { captionRequest } from "../lib/captions";
import { readEvents } from "../lib/calendar";
import type { Project } from "../lib/model";
import { createTranslator } from "next-intl";
import { problemText, type Problem, type Translate } from "../lib/problem";
import en from "../messages/en.json";
import th from "../messages/th.json";

const profile = normalizeProfile(
  {
    ...initialProfile(" Studio ", "Existing custom guidance."),
    brand_personality: { traits: ["Friendly", "Friendly", " "] },
    brand_identity: { name: "Studio", website: "https://example.com", tagline: " " },
    social_platforms: {
      active: ["Instagram", "LinkedIn"],
      guidelines: {
        Instagram: "Use image credits.",
        LinkedIn: "Cite the research.",
        X: "Inactive.",
      },
    },
    content_guidelines: { avoid: ["Guaranteed"], use: ["Partners"] },
  },
  [],
  true,
);
assert.deepEqual(profile.brand_personality?.traits, ["Friendly"]);
assert.deepEqual(profile.brand_identity, { name: "Studio", website: "https://example.com/" });
const project = {
  name: "Studio",
  voice: "Legacy guidance",
  brand: { revision: 2, step: 1, completed: profile, draft: initialProfile("Private draft", "") },
};
const context = brandContext(project, "Instagram").data;
assert.equal(context.preferences?.brand_identity?.name, "Studio");
assert.equal(
  brandContext({ ...project, brand: null }, "Instagram").data.preferences?.brand_voice?.previous,
  "Legacy guidance",
);
assert.equal(context.preferences?.brand_voice?.previous, "Existing custom guidance.");
assert.equal(context.preferences?.social_platforms?.guidelines, "Use image credits.");
assert.deepEqual(context.preferences?.content_guidelines?.use, ["Partners"]);
assert.deepEqual(context.rules, { "Words or phrases to avoid": ["Guaranteed"] });
assert.equal(
  brandContext(project, "TikTok").data.preferences?.social_platforms?.guidelines,
  undefined,
);
assert.deepEqual(normalizeProfile({}, [], false), {});
// Errors carry message keys; the field they are about is translated with them.
assert.throws(() => normalizeProfile({}, [], true), { key: "brandName" });
const tooMany = (() => {
  try {
    normalizeProfile({ brand_personality: { traits: ["1", "2", "3", "4", "5", "6"] } }, [], false);
  } catch (error) {
    return error as Problem;
  }
})();
assert.deepEqual([tooMany?.key, tooMany?.values, tooMany?.field], ["chooseUpTo", { limit: 5 }, "brand_personality.traits"]);
const say = (locale: "en" | "th", problem: Problem) =>
  problemText(createTranslator({ locale, messages: locale === "en" ? en : th }) as unknown as Translate, problem);
assert.equal(say("en", tooMany!), "Personality — Choose up to 5.");
assert.equal(say("th", tooMany!), "บุคลิก — เลือกได้สูงสุด 5 รายการ");
assert.throws(
  () => normalizeProfile({ brand_identity: { website: "javascript:void(0)" } }, [], false),
  { key: "publicUrl", field: "brand_identity.website" },
);
assert.throws(
  () => normalizeProfile({ visual_identity: { primary: "#XYZ" } }, [], false),
  { key: "hexColour" },
);
// Caption prompts keep their cached prefix stable: system, then brand context, then editorial notes.
const captionProject: Project = { id: "p", ...project, channels: ["Instagram", "TikTok"], assets: [], posts: [] };
const blocks = (p: Project, platform: "Instagram" | "TikTok", brief = "Launch") => {
  const request = captionRequest(p, platform, brief);
  const content = request.messages[0].content;
  assert(Array.isArray(content));
  return { system: request.system, content };
};
const bare = blocks(captionProject, "Instagram");
assert.equal(bare.content.length, 2);
assert.deepEqual(bare.content[0].cache_control, { type: "ephemeral" });
const noted: Project = {
  ...captionProject,
  editorial: [
    { id: "1", text: "Fewer emoji.", at: "2026-01-01T00:00:00.000Z" },
    { id: "2", text: "Great hook.", at: "2026-01-02T00:00:00.000Z", platform: "Instagram", caption: "Doors open" },
  ],
};
const withNotes = blocks(noted, "Instagram");
const otherPlatform = blocks(noted, "TikTok", "A different brief");
// Adding a note leaves the system prompt and brand block byte-identical, so they stay cached.
assert.equal(withNotes.system, bare.system);
assert.deepEqual(withNotes.content[0], bare.content[0]);
assert.equal(withNotes.content.length, 3);
assert.deepEqual(withNotes.content[1].cache_control, { type: "ephemeral" });
assert.equal(
  (withNotes.content[1] as { text: string }).text,
  JSON.stringify({
    editorialNotes: [{ note: "Fewer emoji." }, { note: "Great hook.", platform: "Instagram", aboutCaption: "Doors open" }],
  }),
);
// Every platform and brief shares both cached blocks; only the last block differs.
assert.deepEqual(otherPlatform.content.slice(0, 2), withNotes.content.slice(0, 2));
assert.equal(otherPlatform.content[2].cache_control, undefined);
assert.notDeepEqual(otherPlatform.content[2], withNotes.content[2]);
// Calendar replies: out-of-range, malformed and nameless dates are dropped; the rest sorted.
const ev = (date: string, name = "Day") => ({ date, name, why: "Fits.", idea: "Post.", fixed: true });
assert.deepEqual(
  readEvents(JSON.stringify({ events: [ev("2026-12-25"), ev("2026-12-01"), ev("2026-11-27"), ev("2027-01-23"), ev("12/31"), ev("2026-12-02", " ")] }), "2026-11-28").map((e) => e.date),
  ["2026-12-01", "2026-12-25"],
);
console.log("Brand validation, platform context, caption cache layout and calendar checks passed.");
