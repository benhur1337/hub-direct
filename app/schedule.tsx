"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Destination, Post, Project, Status } from "@/lib/model";
import { Problem } from "@/lib/problem";
import {
  api,
  Field,
  Icon,
  localInput,
  Media,
  PlatformMark,
  prettyTime,
  useErrorText,
} from "./ui";
import { PostNotes } from "./editorial";

/** Status labels and saved publishing errors in the reader's language. */
function useStatus() {
  const t = useTranslations("schedule");
  return {
    label: (status: Status) => t(`status.${status}`),
    error: (d: Destination) =>
      d.errorCode === "reconnect"
        ? t("errors.reconnect", { platform: d.platform })
        : d.errorCode === "failed"
          ? t("errors.failed", { platform: d.platform })
          : d.errorCode === "processing"
            ? t("errors.processing", { status: /\(([^)]*)\)/.exec(d.error ?? "")?.[1] ?? "" })
            : d.error,
  };
}

function PostRow({
  project,
  post,
  update,
  open,
}: {
  project: Project;
  post: Post;
  update: (p: Project) => void;
  open?: boolean;
}) {
  const t = useTranslations("schedule");
  const locale = useLocale();
  const errorText = useErrorText();
  const statusText = useStatus();
  const [edit, setEdit] = useState<"" | "reschedule" | "cancel">("");
  const [when, setWhen] = useState(localInput(new Date(post.when)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = post.destinations[0].status;
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const date = new Date(when);
      if (
        edit === "reschedule" &&
        (!when || !Number.isFinite(date.getTime()) || localInput(date) !== when)
      )
        throw new Problem("validLocalTime");
      const data = await api({
        action: edit,
        project: project.id,
        postId: post.id,
        when: edit === "reschedule" ? date.toISOString() : undefined,
      });
      update(data.project);
      setEdit("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="post" open={open}>
      <summary>
        <span className="date-tile">
          <small>
            {new Date(post.when).toLocaleDateString(locale, {
              month: "short",
            })}
          </small>
          {new Date(post.when).getDate()}
        </span>
        <span className="post-summary">
          <strong>{post.brief}</strong>
          <small>
            {prettyTime(post.when, locale)}
            {status !== "Scheduled" && " · " + statusText.label(status)}
          </small>
        </span>
        <span className="route-marks">
          {post.destinations.map((d) => (
            <PlatformMark key={d.platform} platform={d.platform} />
          ))}
        </span>
        <Icon name="chevron" />
      </summary>
      <div className="post-body">
        {post.media.length > 0 && (
          <ol className="media-grid">
            {post.media.map((id, i) => {
              const asset = project.assets.find((a) => a.id === id);
              return (
                asset && (
                  <li key={id}>
                    <Media project={project.id} asset={asset} />
                    <small>
                      {i + 1}. {asset.name}
                    </small>
                  </li>
                )
              );
            })}
          </ol>
        )}
        {post.destinations.map((d) => (
          <div className="caption" key={d.platform}>
            <div className="caption-head">
              <span>
                <PlatformMark platform={d.platform} />
                {d.platform}
              </span>
              <small>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer">
                    {statusText.label(d.status)}
                  </a>
                ) : d.status === "Scheduled" && d.auto ? (
                  t("autoPublish")
                ) : (
                  statusText.label(d.status)
                )}
              </small>
            </div>
            <p className="preserve">{d.caption}</p>
            {d.error && (
              <p className="error" role="alert">
                {statusText.error(d)}
              </p>
            )}
            {d.status === "Publishing" && !d.container && (
              <p className="muted">{t("stuck", { platform: d.platform })}</p>
            )}
          </div>
        ))}
        <PostNotes project={project} post={post} update={update} />
        {status === "Scheduled" &&
          (!edit ? (
            <div className="actions">
              <button
                className="secondary"
                onClick={() => {
                  setWhen(localInput(new Date(post.when)));
                  setEdit("reschedule");
                }}
              >
                {t("reschedule")}
              </button>
              <button className="text-button" onClick={() => setEdit("cancel")}>
                {t("cancelPost")}
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {edit === "reschedule" ? (
                <Field label={t("newTime")}>
                  <input
                    type="datetime-local"
                    required
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                  <small>
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </small>
                </Field>
              ) : (
                <p>{t("cancelConfirm")}</p>
              )}
              <div className="actions">
                <button className="primary" disabled={busy}>
                  {busy ? t("saving") : edit === "cancel" ? t("confirmCancel") : t("saveTime")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setEdit("");
                    setError("");
                  }}
                >
                  {t("keepSchedule")}
                </button>
              </div>
            </form>
          ))}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
type Mode = "list" | "day" | "week" | "month";
const modes: Mode[] = ["list", "day", "week", "month"];
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d: Date) => d.toDateString();
const startOfToday = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

/** Visible days for a calendar mode; weeks start on Sunday. */
function calendarDays(mode: Exclude<Mode, "list">, anchor: Date) {
  if (mode === "day") return [anchor];
  const first =
    mode === "week" ? anchor : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const monthLength = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const length =
    mode === "week" ? 7 : Math.ceil((first.getDay() + monthLength) / 7) * 7;
  return Array.from({ length }, (_, i) => addDays(start, i));
}

function Calendar({
  project,
  update,
  mode,
}: {
  project: Project;
  update: (p: Project) => void;
  mode: Exclude<Mode, "list">;
}) {
  const t = useTranslations("schedule");
  const locale = useLocale();
  const statusText = useStatus();
  const [anchor, setAnchor] = useState(startOfToday);
  const [selected, setSelected] = useState("");
  const today = dayKey(new Date());
  const days = calendarDays(mode, anchor);
  const byDay = new Map<string, Post[]>();
  for (const post of [...project.posts].sort((a, b) => a.when.localeCompare(b.when))) {
    const key = dayKey(new Date(post.when));
    byDay.set(key, [...(byDay.get(key) ?? []), post]);
  }
  const step = (n: number) =>
    setAnchor(
      mode === "month"
        ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
        : addDays(anchor, n * (mode === "week" ? 7 : 1)),
    );
  const label =
    mode === "month"
      ? anchor.toLocaleDateString(locale, { month: "long", year: "numeric" })
      : mode === "week"
        ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).formatRange(
            days[0],
            days[6],
          )
        : anchor.toLocaleDateString(locale, { dateStyle: "full" });
  const picked = project.posts.find((p) => p.id === selected);
  const dayPosts = byDay.get(dayKey(anchor)) ?? [];
  return (
    <>
      <div className="calendar-nav">
        <button className="icon-button" aria-label={t("previous")} onClick={() => step(-1)}>
          <span className="flip">
            <Icon name="chevron" />
          </span>
        </button>
        <button className="secondary" onClick={() => setAnchor(startOfToday())}>
          {t("today")}
        </button>
        <button className="icon-button" aria-label={t("next")} onClick={() => step(1)}>
          <Icon name="chevron" />
        </button>
        <h3 aria-live="polite">{label}</h3>
      </div>
      {mode === "day" ? (
        dayPosts.length ? (
          dayPosts.map((post) => (
            <PostRow key={post.id} {...{ project, post, update }} />
          ))
        ) : (
          <div className="empty">
            <Icon name="calendar" size={26} />
            <strong>{t("emptyDay")}</strong>
          </div>
        )
      ) : (
        <ol className={"calendar " + mode}>
          {days.map((d) => (
            <li
              key={dayKey(d)}
              className={
                (dayKey(d) === today ? "today " : "") +
                (mode === "month" && d.getMonth() !== anchor.getMonth() ? "outside" : "")
              }
            >
              <small className="day-head">
                {d.toLocaleDateString(locale, { weekday: "short", day: "numeric" })}
              </small>
              {(byDay.get(dayKey(d)) ?? []).map((post) => {
                const status = post.destinations[0].status;
                return (
                  <button
                    key={post.id}
                    className={
                      "chip" +
                      (post.id === selected ? " selected" : "") +
                      (status === "Canceled" || status === "Failed" ? " dim" : "")
                    }
                    aria-pressed={post.id === selected}
                    title={`${prettyTime(post.when, locale)} · ${statusText.label(status)}`}
                    onClick={() => setSelected(post.id === selected ? "" : post.id)}
                  >
                    <time>
                      {new Date(post.when).toLocaleTimeString(locale, {
                        timeStyle: "short",
                      })}
                    </time>
                    <span className="route-marks">
                      {post.destinations.map((x) => (
                        <PlatformMark key={x.platform} platform={x.platform} />
                      ))}
                    </span>
                    <span className="chip-brief">{post.brief}</span>
                  </button>
                );
              })}
            </li>
          ))}
        </ol>
      )}
      {picked && mode !== "day" && (
        <PostRow key={picked.id} open {...{ project, update }} post={picked} />
      )}
    </>
  );
}

export function Schedule({
  project,
  update,
  compose,
}: {
  project: Project;
  update: (p: Project) => void;
  compose: () => void;
}) {
  const t = useTranslations("schedule");
  const [mode, setMode] = useState<Mode>("list");
  const upcoming = project.posts.filter((p) =>
    p.destinations.some((d) => d.status === "Scheduled"),
  );
  const history = project.posts
    .filter((p) => p.destinations.every((d) => d.status !== "Scheduled"))
    .reverse();
  return (
    <section className="schedule-view">
      <div className="title-row">
        <div>
          <h2>{t("title")}</h2>
          <p className="muted">
            {t("timesIn", { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
          </p>
        </div>
        <button className="primary" onClick={compose}>
          <Icon name="plus" />
          {t("compose")}
        </button>
      </div>
      <div className="tabs schedule-modes" role="group" aria-label={t("view")}>
        {modes.map((m) => (
          <button
            key={m}
            aria-current={mode === m ? "page" : undefined}
            onClick={() => setMode(m)}
          >
            {mode === m && <span className="tab-outline" />}
            {t(`modes.${m}`)}
          </button>
        ))}
      </div>
      <div
        className="schedule-list"
        role="region"
        aria-label={t("posts")}
        tabIndex={0}
      >
        {mode !== "list" ? (
          <Calendar key={mode} {...{ project, update, mode }} />
        ) : (
        <>
        <h3>
          {t("upcoming")} <span className="count">{upcoming.length}</span>
        </h3>
        {upcoming.length ? (
          upcoming.map((post) => (
            <PostRow key={post.id} {...{ project, post, update }} />
          ))
        ) : (
          <div className="empty">
            <Icon name="calendar" size={26} />
            <strong>{t("clear")}</strong>
            <p>{t("clearHint")}</p>
          </div>
        )}
        {history.length > 0 && (
          <section>
            <h3>{t("history")}</h3>
            {history.map((post) => (
              <PostRow key={post.id} {...{ project, post, update }} />
            ))}
          </section>
        )}
        </>
        )}
      </div>
    </section>
  );
}
