"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Project } from "@/lib/model";
import type { CalendarEvent } from "@/lib/calendar";
import { api, Icon, localInput, Spinner, useErrorText } from "./ui";

/** A calendar date turned into a planner draft. */
export type Seed = { brief: string; date: string };
// "YYYY-MM-DD" read as a local day, not UTC midnight.
const day = (date: string) => new Date(date + "T00:00");

function readSaved(id: string): CalendarEvent[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem("calendar-" + id) || "null");
    if (Array.isArray(saved)) return saved;
  } catch {
    /* Suggestions are cheap to ask for again. */
  }
  return [];
}

export function BrandCalendar({ project, plan }: { project: Project; plan: (seed: Seed) => void }) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const errorText = useErrorText();
  const [events, setEvents] = useState(() => readSaved(project.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      sessionStorage.setItem("calendar-" + project.id, JSON.stringify(events));
    } catch {
      /* Keep them in memory. */
    }
  }, [events, project.id]);

  async function suggest() {
    setBusy(true);
    setError("");
    try {
      setEvents((await api({ action: "calendar", project: project.id, from: localInput(new Date()).slice(0, 10) })).events);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="schedule-view">
      <div className="title-row">
        <div>
          <h2>{t("title")}</h2>
          <p className="lead">{t("lead")}</p>
        </div>
        <button className="primary" disabled={busy} onClick={() => void suggest()}>
          {busy ? <Spinner /> : <Icon name="spark" />}
          {busy ? t("finding") : events.length ? t("refresh") : t("suggest")}
        </button>
      </div>
      <div className="schedule-list" aria-busy={busy}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {busy ? (
          // Placeholder rows in the shape of the real ones while Claude picks dates (10–20 s).
          <ol className="event-list" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <li className="event-row" key={i}>
                <span className="date-tile skeleton" />
                <span className="post-summary">
                  <span className="skeleton line" />
                  <span className="skeleton line long" />
                </span>
              </li>
            ))}
          </ol>
        ) : events.length ? (
          <ol className="event-list">
            {events.map((e) => (
              <li className="event-row" key={e.date + e.name}>
                <time className="date-tile" dateTime={e.date}>
                  <small>{day(e.date).toLocaleDateString(locale, { month: "short" })}</small>
                  {day(e.date).getDate()}
                </time>
                <span className="post-summary">
                  <strong>{e.name}</strong>
                  <small>{e.why}</small>
                  <small>{e.idea}</small>
                  {!e.fixed && <small className="plan-issue">{t("checkDate")}</small>}
                </span>
                <button className="secondary" onClick={() => plan({ brief: e.name + " — " + e.idea, date: e.date })}>
                  {t("makePost")}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty">
            <Icon name="dates" size={26} />
            <strong>{t("empty")}</strong>
            <p>{t("emptyHint")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
