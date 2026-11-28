"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { platforms, type Asset, type Platform, type Post, type Project } from "@/lib/model";
import { Problem, type ErrorKey } from "@/lib/problem";
import type { Seed } from "./brand-calendar";
import {
  api,
  cachedBatch,
  Field,
  forPosting,
  Icon,
  localInput,
  Media,
  mediaAccept,
  PlatformMark,
  prettyTime,
  uploadBatch,
  uploadMedia,
  UploadStatus,
  useBatchLabel,
  useErrorText,
  Spinner,
} from "./ui";

/** A queued post. `when` is a local datetime-local value, like the composer's. */
type Plan = {
  id: string;
  brief: string;
  media: string[];
  mediaDescription: string;
  selected: Platform[];
  captions: Partial<Record<Platform, string>>;
  when: string;
  error?: string;
};
type Saved = { drafts: Plan[]; time: string };

const batchLimit = 50;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfToday = () => addDays(new Date(), 0);
const dateValue = (d: Date) => localInput(d).slice(0, 10);
const sameDay = (when: string | Date, day: Date) => new Date(when).toDateString() === day.toDateString();
const at = (day: Date, time: string) => {
  const [h, m] = time.split(":").map(Number);
  return localInput(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m));
};

function readSaved(project: Project): Saved {
  try {
    const saved = JSON.parse(sessionStorage.getItem("plan-" + project.id) || "null") as Saved | null;
    if (saved && Array.isArray(saved.drafts))
      // Drafts already scheduled (a lost response, another tab) leave the queue.
      return { time: saved.time || "10:00", drafts: saved.drafts.filter((d) => !project.posts.some((p) => p.id === d.id)) };
  } catch {
    /* Memory-only queues also work when browser storage is disabled. */
  }
  return { drafts: [], time: "10:00" };
}
function blank(project: Project, when: string, media: string[] = []): Plan {
  return { id: crypto.randomUUID(), brief: "", media, mediaDescription: "", selected: [...project.channels], captions: {}, when };
}
/** What still stops a queued post from being scheduled (an errors.* key), or undefined when it is ready. */
function problem(d: Plan): ErrorKey | undefined {
  const date = new Date(d.when);
  if (!d.brief.trim()) return "addBrief";
  if (!d.selected.length) return "selectDestination";
  if (d.selected.some((p) => !d.captions[p]?.trim())) return "addCaptions";
  if (!(date.getTime() > Date.now())) return "futureTime";
  if (localInput(date) !== d.when) return "clockChange";
}
const canGenerate = (d: Plan) => !!d.brief.trim() && (!d.media.length || !!d.mediaDescription.trim());

export function Planner({
  project,
  update,
  navigate,
  seed,
}: {
  project: Project;
  update: (project: Project) => void;
  navigate: (view: "channels" | "schedule") => void;
  /** A brand calendar date to queue as a draft on that day. */
  seed?: Seed;
}) {
  const t = useTranslations("planner");
  const tUpload = useTranslations("upload");
  const locale = useLocale();
  const errorText = useErrorText();
  const batchLabel = useBatchLabel();
  const [saved] = useState(() => readSaved(project));
  const [drafts, setDrafts] = useState(() =>
    seed ? [...saved.drafts, { ...blank(project, at(new Date(seed.date + "T00:00"), saved.time)), brief: seed.brief }] : saved.drafts,
  );
  const [time, setTime] = useState(saved.time);
  // Opens on the week holding the calendar date, so the new draft is in view.
  const [week, setWeek] = useState(() =>
    // Rounded to whole days first so a daylight-saving hour cannot push it into the wrong week.
    seed ? Math.max(0, Math.floor(Math.round((new Date(seed.date + "T00:00").getTime() - startOfToday().getTime()) / 86400000) / 7)) : 0,
  );
  const [busy, setBusy] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [confirming, setConfirming] = useState<string[] | null>(null);
  // Offers a link to the schedule after posts are scheduled.
  const [scheduledNote, setScheduledNote] = useState(false);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    try {
      sessionStorage.setItem("plan-" + project.id, JSON.stringify({ drafts, time }));
    } catch {
      /* Keep the in-memory queue. */
    }
  }, [drafts, time, project.id]);

  const first = addDays(startOfToday(), week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const live = (post: Post) => post.destinations.some((d) => d.status !== "Canceled");

  function patch(id: string, values: Partial<Plan>) {
    setDrafts((all) => all.map((d) => (d.id === id ? { ...d, ...values, error: undefined } : d)));
    setError("");
    setStatus("");
    setScheduledNote(false);
  }
  async function work(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setStatus("");
    setScheduledNote(false);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
      setPercent(null);
    }
  }
  /** One post per file, each on the next day that has nothing queued or scheduled. */
  function place(assets: Asset[], queue: Plan[]) {
    const taken = (day: Date) =>
      queue.some((d) => sameDay(d.when, day)) || project.posts.some((p) => live(p) && sameDay(p.when, day));
    let day = first;
    if (Date.parse(at(day, time)) <= Date.now()) day = addDays(day, 1);
    const placed: Plan[] = [];
    for (const asset of assets) {
      for (let tries = 0; tries < 90 && taken(day); tries++) day = addDays(day, 1);
      const draft = blank(project, at(day, time), [asset.id]);
      placed.push(draft);
      queue = [...queue, draft];
    }
    return placed;
  }
  async function generate(d: Plan, p: Platform) {
    try {
      const data = await api({
        action: "generate",
        project: project.id,
        platform: p,
        brief: d.brief,
        media: d.media,
        mediaDescription: d.mediaDescription,
      });
      // Keep each caption as it lands so one failure does not discard the rest.
      setDrafts((all) => all.map((x) => (x.id === d.id ? { ...x, captions: { ...x.captions, [p]: data.caption } } : x)));
    } catch (err) {
      setDrafts((all) => all.map((x) => (x.id === d.id ? { ...x, error: errorText(err) } : x)));
      throw err;
    }
  }
  /** Missing captions only, or every caption when `all` (a card's Regenerate). */
  function captionJobs(list: Plan[], all = false) {
    return list.flatMap((d) =>
      canGenerate(d) ? d.selected.filter((p) => all || !d.captions[p]?.trim()).map((p) => () => generate(d, p)) : [],
    );
  }
  async function generateAll(list: Plan[], all = false) {
    const results = await cachedBatch(captionJobs(list, all));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) throw new Problem("captionsFailed", 400, { failed, total: results.length });
    setStatus(t("generated", { count: results.length }));
  }
  async function scheduleAll(ids: string[]) {
    let scheduled = 0;
    for (const id of ids) {
      const d = drafts.find((x) => x.id === id);
      if (!d) continue;
      try {
        const data = await api({
          action: "schedule",
          project: project.id,
          draftId: d.id,
          brief: d.brief,
          media: d.media,
          captions: Object.fromEntries(d.selected.map((p) => [p, d.captions[p]])),
          when: new Date(d.when).toISOString(),
        });
        update(data.project);
        setDrafts((all) => all.filter((x) => x.id !== id));
        scheduled++;
      } catch (err) {
        setDrafts((all) => all.map((x) => (x.id === id ? { ...x, error: errorText(err) } : x)));
      }
    }
    setConfirming(null);
    if (scheduled < ids.length) throw new Problem("scheduledSome", 400, { done: scheduled, total: ids.length });
    setStatus(t("scheduled", { count: scheduled }));
    setScheduledNote(true);
  }

  if (!project.channels.length)
    return (
      <section className="compose-intro">
        <h2>{t("title")}</h2>
        <p>{t("noChannels")}</p>
        <button className="primary" onClick={() => navigate("channels")}>
          {t("connectChannels")}
          <Icon name="arrow" />
        </button>
      </section>
    );

  const missing = captionJobs(drafts).length;
  const waiting = drafts.filter((d) => !canGenerate(d) && d.selected.some((p) => !d.captions[p]?.trim())).length;
  const ready = drafts.filter((d) => !problem(d));
  const confirmList = confirming && drafts.filter((d) => confirming.includes(d.id));
  const range = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).formatRange(days[0], days[6]);

  return (
    <div className="planner">
      <div className="compose-heading">
        <h2>{t("title")}</h2>
        <p className="lead">{t("lead")}</p>
      </div>
      <div className="form-panel plan-tools">
        <div className="upload">
          <Icon name="upload" size={23} />
          <UploadStatus busy={busy} percent={percent} idle={t("uploadIdle")} />
          <small>{t("uploadHint", { limit: batchLimit })}</small>
          <input
            aria-label={t("uploadLabel")}
            type="file"
            accept={mediaAccept}
            multiple
            disabled={!!busy}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (!files.length) return;
              void work(tUpload("uploading"), async () => {
                if (files.length > batchLimit) throw new Problem("batchLimit", 400, { limit: batchLimit });
                let assets = project.assets;
                await uploadBatch(
                  project.id,
                  files,
                  (step, p) => {
                    setBusy(batchLabel(step));
                    setPercent(p);
                  },
                  (added) => {
                    assets = [...assets, ...added];
                    update({ ...project, assets });
                    setDrafts((all) => [...all, ...place(added, all)]);
                  },
                );
                setStatus(t("queued", { count: files.length }));
              });
            }}
          />
        </div>
        <div className="plan-controls">
          <Field label={t("defaultTime")}>
            <input type="time" required value={time} disabled={!!busy} onChange={(e) => setTime(e.target.value || "10:00")} />
            <small>{zone}</small>
          </Field>
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={!!busy || !missing}
              onClick={() => void work(t("generatingAll"), () => generateAll(drafts))}
            >
              {busy === t("generatingAll") ? <Spinner /> : <Icon name="spark" size={15} />}
              {busy === t("generatingAll") ? busy : t("generateMissing", { count: missing })}
            </button>
            <button
              type="button"
              className="primary"
              disabled={!!busy || !ready.length}
              onClick={() => setConfirming(ready.map((d) => d.id))}
            >
              <Icon name="calendar" />
              {t("scheduleReady", { count: ready.length })}
            </button>
          </div>
          {waiting > 0 && (
            <small>{t("waiting", { count: waiting })}</small>
          )}
        </div>
        {confirmList && confirmList.length > 0 && (
          <div className="confirm-delete" role="alertdialog" aria-labelledby="plan-confirm">
            <p id="plan-confirm">
              <strong>{t("confirmTitle", { count: confirmList.length })}</strong> {t("timesIn", { zone })}
            </p>
            <ul className="plan-confirm">
              {confirmList.map((d) => (
                <li key={d.id}>
                  <time>{prettyTime(d.when, locale)}</time>
                  <span className="route-marks">
                    {d.selected.map((p) => (
                      <PlatformMark key={p} platform={p} />
                    ))}
                  </span>
                  <span>
                    {d.selected.join(", ")}: {d.brief}
                  </span>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button
                className="primary"
                disabled={!!busy}
                onClick={() => void work(t("scheduling"), () => scheduleAll(confirmList.map((d) => d.id)))}
              >
                {busy === t("scheduling") && <Spinner />}
                {busy === t("scheduling") ? busy : t("confirm")}
              </button>
              <button className="secondary" disabled={!!busy} autoFocus onClick={() => setConfirming(null)}>
                {t("keepEditing")}
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="plan-status">
            {status}{" "}
            {scheduledNote && (
              <button className="text-button" onClick={() => navigate("schedule")}>
                {t("openSchedule")}
              </button>
            )}
          </p>
        )}
      </div>

      <div className="calendar-nav plan-nav">
        <button className="icon-button" aria-label={t("previousWeek")} disabled={!week} onClick={() => setWeek(week - 1)}>
          <span className="flip">
            <Icon name="chevron" />
          </span>
        </button>
        <button className="secondary" disabled={!week} onClick={() => setWeek(0)}>
          {t("next7")}
        </button>
        <button className="icon-button" aria-label={t("followingWeek")} onClick={() => setWeek(week + 1)}>
          <Icon name="chevron" />
        </button>
        <h3 aria-live="polite">{range}</h3>
      </div>
      <ol className="plan-strip" aria-label={t("glance")}>
        {days.map((day) => {
          const queued = drafts.filter((d) => sameDay(d.when, day));
          const posts = project.posts.filter((p) => live(p) && sameDay(p.when, day));
          return (
            <li key={dateValue(day)}>
              <a href={"#plan-" + dateValue(day)}>
                <small className="day-head">{day.toLocaleDateString(locale, { weekday: "short" })}</small>
                <strong>{day.getDate()}</strong>
                <small>
                  {t("queuedCount", { count: queued.length })}
                  {posts.length > 0 && " · " + t("scheduledCount", { count: posts.length })}
                </small>
              </a>
            </li>
          );
        })}
      </ol>
      {days.map((day) => {
        const key = dateValue(day);
        const queued = drafts
          .filter((d) => sameDay(d.when, day))
          .sort((a, b) => a.when.localeCompare(b.when));
        const posts = project.posts.filter((p) => live(p) && sameDay(p.when, day));
        return (
          <section className="plan-day" id={"plan-" + key} key={key} aria-labelledby={"plan-h-" + key}>
            <div className="plan-day-head">
              <h3 id={"plan-h-" + key}>{day.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })}</h3>
              <button
                className="text-button"
                disabled={!!busy}
                onClick={() => setDrafts((all) => [...all, blank(project, at(day, time))])}
              >
                <Icon name="plus" size={15} />
                {t("addPost")}
              </button>
            </div>
            {posts.length > 0 && (
              <ul className="plan-booked" aria-label={t("alreadyScheduled")}>
                {posts.map((p) => (
                  <li key={p.id}>
                    <time>{new Date(p.when).toLocaleTimeString(locale, { timeStyle: "short" })}</time>
                    <span className="route-marks">
                      {p.destinations.map((d) => (
                        <PlatformMark key={d.platform} platform={d.platform} />
                      ))}
                    </span>
                    <span className="chip-brief">{p.brief}</span>
                  </li>
                ))}
              </ul>
            )}
            {queued.length > 0 ? (
              <ul className="plan-cards">
                {queued.map((d) => (
                  <PlanCard
                    key={d.id}
                    {...{ project, update, days, busy, setBusy, setPercent }}
                    draft={d}
                    patch={(values) => patch(d.id, values)}
                    remove={() => setDrafts((all) => all.filter((x) => x.id !== d.id))}
                    generate={() =>
                      work("generate:" + d.id, () => generateAll([d], d.selected.every((p) => d.captions[p]?.trim())))
                    }
                    schedule={() => setConfirming([d.id])}
                  />
                ))}
              </ul>
            ) : (
              !posts.length && <p className="muted plan-empty">{t("nothingPlanned")}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PlanCard({
  project,
  update,
  draft: d,
  days,
  busy,
  setBusy,
  setPercent,
  patch,
  remove,
  generate,
  schedule,
}: {
  project: Project;
  update: (p: Project) => void;
  draft: Plan;
  days: Date[];
  busy: string;
  setBusy: (label: string) => void;
  setPercent: (p: number | null) => void;
  patch: (values: Partial<Plan>) => void;
  remove: () => void;
  generate: () => void;
  schedule: () => void;
}) {
  const t = useTranslations("planner");
  const tUpload = useTranslations("upload");
  const locale = useLocale();
  const errorText = useErrorText();
  const [uploadError, setUploadError] = useState("");
  const assets = d.media.flatMap((id) => project.assets.find((a) => a.id === id) || []);
  const issue = problem(d);
  const day = d.when.slice(0, 10);
  const date = new Date(d.when).toLocaleDateString(locale, { dateStyle: "medium" });
  return (
    <li className="plan-card">
      <fieldset disabled={!!busy} className="draft-column">
        {assets.length > 0 && (
          <ol className="media-grid" aria-label={t("attachmentOrder")}>
            {assets.map((a) => (
              <li key={a.id}>
                <Media project={project.id} asset={a} />
                <button
                  type="button"
                  className="text-button"
                  aria-label={t("removeMedia", { name: a.name })}
                  onClick={() => patch({ media: d.media.filter((id) => id !== a.id) })}
                >
                  <Icon name="close" size={15} />
                  {a.name}
                </button>
              </li>
            ))}
          </ol>
        )}
        <label className="text-button plan-add-media">
          <Icon name="upload" size={15} />
          {assets.length ? t("addMedia") : t("attachMedia")}
          <input
            type="file"
            className="visually-hidden"
            aria-label={t("attachMediaFor", { date })}
            accept={mediaAccept}
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (!files.length) return;
              setUploadError("");
              setBusy(tUpload("uploading"));
              forPosting(files, (p) => {
                setBusy(tUpload("converting"));
                setPercent(p);
              })
                .then((ready) => uploadMedia(project.id, ready, { existing: d.media }))
                .then((added) => {
                  update({ ...project, assets: [...project.assets, ...added] });
                  patch({ media: [...d.media, ...added.map((a) => a.id)] });
                })
                .catch((err) => setUploadError(errorText(err)))
                .finally(() => {
                  setBusy("");
                  setPercent(null);
                });
            }}
          />
        </label>
        <Field label={t("brief")}>
          <textarea
            required
            maxLength={4000}
            value={d.brief}
            onChange={(e) => patch({ brief: e.target.value })}
            placeholder={t("briefPlaceholder")}
          />
        </Field>
        {assets.length > 0 && (
          <Field label={t("describeMedia")}>
            <textarea
              maxLength={1000}
              value={d.mediaDescription}
              onChange={(e) => patch({ mediaDescription: e.target.value })}
              placeholder={t("describePlaceholder")}
            />
            <small>{t("describeHint")}</small>
          </Field>
        )}
        <div className="plan-when">
          <Field label={t("day")}>
            <select
              value={day}
              onChange={(e) => {
                const [y, m, n] = e.target.value.split("-").map(Number);
                patch({ when: at(new Date(y, m - 1, n), d.when.slice(11, 16)) });
              }}
            >
              {!days.some((x) => dateValue(x) === day) && <option value={day}>{day}</option>}
              {days.map((x) => (
                <option key={dateValue(x)} value={dateValue(x)}>
                  {x.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("time")}>
            <input
              type="time"
              required
              value={d.when.slice(11, 16)}
              onChange={(e) => e.target.value && patch({ when: day + "T" + e.target.value })}
            />
          </Field>
        </div>
        <div className="choices" role="group" aria-label={t("destinationsFor", { date })}>
          {platforms
            .filter((p) => project.channels.includes(p))
            .map((p) => (
              <label key={p}>
                <input
                  type="checkbox"
                  checked={d.selected.includes(p)}
                  onChange={(e) =>
                    patch({ selected: e.target.checked ? [...d.selected, p] : d.selected.filter((x) => x !== p) })
                  }
                />
                <PlatformMark platform={p} />
                {p}
              </label>
            ))}
        </div>
        {d.selected.map((p) => (
          <div className="caption" key={p}>
            <div className="caption-head">
              <span>
                <PlatformMark platform={p} />
                {p}
              </span>
            </div>
            <textarea
              aria-label={t("captionFor", { platform: p, date })}
              maxLength={6000}
              value={d.captions[p] || ""}
              onChange={(e) => patch({ captions: { ...d.captions, [p]: e.target.value } })}
              placeholder={t("captionPlaceholder")}
            />
          </div>
        ))}
        {(d.error || uploadError) && (
          <p className="error" role="alert">
            {d.error || uploadError}
          </p>
        )}
        {issue && <small className="plan-issue">{errorText(new Problem(issue))}</small>}
        <div className="actions">
          <button
            type="button"
            className="secondary"
            disabled={!canGenerate(d) || !d.selected.length}
            title={canGenerate(d) ? undefined : t("describeFirst")}
            onClick={generate}
          >
            {busy === "generate:" + d.id ? <Spinner /> : <Icon name="spark" size={15} />}
            {busy === "generate:" + d.id
              ? t("generating")
              : d.selected.every((p) => d.captions[p]?.trim())
                ? t("regenerate")
                : d.selected.some((p) => d.captions[p]?.trim())
                  ? t("fillMissing")
                  : t("generate")}
          </button>
          <button type="button" className="primary" disabled={!!issue} onClick={schedule}>
            {t("schedule")}
          </button>
          <button type="button" className="text-button" onClick={remove}>
            {t("remove")}
          </button>
        </div>
      </fieldset>
    </li>
  );
}
