"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Problem } from "@/lib/problem";
import {
  noteLength,
  platforms,
  type Platform,
  type Project,
} from "@/lib/model";
import {
  api,
  cachedBatch,
  forPosting,
  Field,
  Icon,
  localInput,
  mediaAccept,
  Media,
  PlatformMark,
  prettyTime,
  uploadMedia,
  UploadStatus,
  useErrorText,
  Spinner,
} from "./ui";

type Draft = {
  id: string;
  brief: string;
  media: string[];
  mediaDescription?: string;
  selected: Platform[];
  captions: Partial<Record<Platform, string>>;
  when: string;
  /** Editorial feedback saved with the brand voice when the post is scheduled. */
  note?: string;
};
function readDraft(project: Project): Draft {
  try {
    const saved = sessionStorage.getItem("draft-" + project.id);
    if (saved) {
      const draft = JSON.parse(saved) as Draft;
      if (
        draft.id &&
        Array.isArray(draft.media) &&
        Array.isArray(draft.selected) &&
        !project.posts.some((p) => p.id === draft.id)
      )
        return draft;
    }
  } catch {
    /* Memory-only drafts also work when browser storage is disabled. */
  }
  return {
    id: crypto.randomUUID(),
    brief: "",
    media: [],
    mediaDescription: "",
    selected: [...project.channels],
    captions: {},
    when: localInput(new Date(Date.now() + 3600000)),
  };
}
export function Composer({
  project,
  update,
  navigate,
}: {
  project: Project;
  update: (project: Project) => void;
  navigate: (view: "schedule" | "channels") => void;
}) {
  const t = useTranslations("composer");
  const tUpload = useTranslations("upload");
  const locale = useLocale();
  const errorText = useErrorText();
  const [draft, setDraft] = useState(() => readDraft(project));
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState("");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    if (!project.channels.length) return;
    try {
      sessionStorage.setItem("draft-" + project.id, JSON.stringify(draft));
    } catch {
      /* Keep the in-memory draft. */
    }
  }, [draft, project.id, project.channels.length]);
  function patch(values: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...values }));
    setError("");
  }
  async function work(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
      setPercent(null);
    }
  }
  function move(index: number, offset: number) {
    const media = [...draft.media];
    [media[index], media[index + offset]] = [
      media[index + offset],
      media[index],
    ];
    patch({ media });
  }
  const assets = draft.media.flatMap(
    (id) => project.assets.find((a) => a.id === id) || [],
  );
  const describe = assets.length > 0 && !draft.mediaDescription?.trim();
  function checkTime() {
    const date = new Date(draft.when);
    if (
      !draft.when ||
      Number.isNaN(date.getTime()) ||
      date.getTime() <= Date.now()
    )
      throw new Problem("futureTime");
    if (localInput(date) !== draft.when) throw new Problem("clockChange");
    return date.toISOString();
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
  return (
    <div className="compose-layout">
      <div className="compose-heading">
        <h2>{review ? t("reviewTitle") : t("title")}</h2>
        <p className="lead">{review ? t("reviewLead") : t("lead")}</p>
      </div>
      <form
        className="form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          void work(review ? t("scheduling") : t("reviewing"), async () => {
            const when = checkTime();
            if (!draft.selected.length) throw new Problem("selectDestination");
            if (!review) {
              setReview(true);
              window.scrollTo({ top: 0 });
              return;
            }
            const captions = Object.fromEntries(
              draft.selected.map((p) => [p, draft.captions[p]]),
            );
            const data = await api({
              action: "schedule",
              project: project.id,
              draftId: draft.id,
              brief: draft.brief,
              media: draft.media,
              captions,
              when,
              note: draft.note?.trim() || undefined,
            });
            update(data.project);
            try {
              sessionStorage.removeItem("draft-" + project.id);
            } catch {
              /* In-memory draft is cleared on navigation. */
            }
            navigate("schedule");
          });
        }}
      >
        <fieldset
          className="draft-fields"
          aria-label={review ? t("detailsToReview") : t("content")}
          tabIndex={review ? 0 : undefined}
          disabled={!!busy}
          key={review ? "review" : "edit"}
        >
          <div className="draft-column">
            {review ? (
              <h3>{draft.brief}</h3>
            ) : (
              <>
                <Field label={t("brief")}>
                  <textarea
                    required
                    maxLength={4000}
                    value={draft.brief}
                    onChange={(e) => patch({ brief: e.target.value })}
                    placeholder={t("briefPlaceholder")}
                  />
                </Field>
                <div className="field">
                  <span>
                    {t("media")} <small>{t("optional")}</small>
                  </span>
                  <div className="upload">
                    <Icon name="upload" size={23} />
                    <UploadStatus busy={busy} percent={percent} idle={t("chooseMedia")} />
                    <small>{assets.length ? t("attached", { count: assets.length }) : t("mediaLimits")}</small>
                    <input
                      aria-label={t("uploadMedia")}
                      type="file"
                      accept={mediaAccept}
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        e.target.value = "";
                        if (!files.length) return;
                        void work(tUpload("uploading"), async () => {
                          const ready = await forPosting(files, (p) => {
                            setBusy(tUpload("converting"));
                            setPercent(p);
                          });
                          setBusy(tUpload("uploading"));
                          setPercent(0);
                          const added = await uploadMedia(
                            project.id,
                            ready,
                            { existing: draft.media },
                            setPercent,
                          );
                          update({
                            ...project,
                            assets: [...project.assets, ...added],
                          });
                          patch({
                            media: [...draft.media, ...added.map((a) => a.id)],
                          });
                        });
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            {assets.length > 0 && (
              <ol className="media-grid" aria-label={t("attachmentOrder")}>
                {assets.map((a, i) => (
                  <motion.li key={a.id} layout="position" layoutDependency={draft.media}>
                    <Media project={project.id} asset={a} />
                    <span className="filename">
                      {i + 1}. {a.name}
                    </span>
                    {!review && (
                      <div className="media-actions">
                        <button
                          type="button"
                          aria-label={t("moveEarlier", { name: a.name })}
                          disabled={!i}
                          onClick={() => move(i, -1)}
                        >
                          <Icon name="back" size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={t("moveLater", { name: a.name })}
                          disabled={i === assets.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <Icon name="arrow" size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={t("remove", { name: a.name })}
                          onClick={() =>
                            patch({
                              media: draft.media.filter((id) => id !== a.id),
                            })
                          }
                        >
                          <Icon name="close" size={15} />
                        </button>
                      </div>
                    )}
                  </motion.li>
                ))}
              </ol>
            )}
            {!review && assets.length > 0 && (
              <Field label={t("describeMedia")}>
                <textarea
                  required
                  maxLength={1000}
                  value={draft.mediaDescription || ""}
                  onChange={(e) => patch({ mediaDescription: e.target.value })}
                  placeholder={t("describePlaceholder")}
                />
                <small>{t("describeHint")}</small>
              </Field>
            )}
            {!review && (
              <div className="field">
                <span>{t("destinations")}</span>
                <div className="choices">
                  {platforms
                    .filter((p) => project.channels.includes(p))
                    .map((p) => (
                      <label key={p}>
                        <input
                          type="checkbox"
                          checked={draft.selected.includes(p)}
                          onChange={(e) =>
                            patch({
                              selected: e.target.checked
                                ? [...draft.selected, p]
                                : draft.selected.filter((item) => item !== p),
                            })
                          }
                        />
                        <PlatformMark platform={p} />
                        {p}
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="draft-column">
            {!review && draft.selected.length > 1 && (
              <button
                type="button"
                className="secondary"
                disabled={!!busy || !draft.brief.trim() || describe}
                title={describe ? t("describeFirst") : undefined}
                onClick={() =>
                  void work(t("generatingAll"), async () => {
                    const one = async (p: Platform) => {
                        const data = await api({
                          action: "generate",
                          project: project.id,
                          platform: p,
                          brief: draft.brief,
                          media: draft.media,
                          mediaDescription: draft.mediaDescription,
                        });
                        // Keep each caption as it lands so one failure does not discard the rest.
                        setDraft((prev) => ({
                          ...prev,
                          captions: { ...prev.captions, [p]: data.caption },
                        }));
                      };
                    const results = await cachedBatch(draft.selected.map((p) => () => one(p)));
                    const failed = results.find((r) => r.status === "rejected");
                    if (failed) throw failed.reason;
                  })
                }
              >
                {busy === t("generatingAll") ? <Spinner /> : <Icon name="spark" size={15} />}
                {busy === t("generatingAll") ? t("generatingAll") : t("generateAll")}
              </button>
            )}
            {draft.selected.map((p) => (
              <div className="caption" key={p}>
                <div className="caption-head">
                  <span>
                    <PlatformMark platform={p} />
                    {p}
                  </span>
                  {!review && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={!!busy || !draft.brief.trim() || describe}
                      title={describe ? t("describeFirst") : undefined}
                      onClick={() =>
                        void work(t("generatingFor", { platform: p }), async () => {
                          const data = await api({
                            action: "generate",
                            project: project.id,
                            platform: p,
                            brief: draft.brief,
                            media: draft.media,
                            mediaDescription: draft.mediaDescription,
                          });
                          setDraft((prev) => ({
                            ...prev,
                            captions: { ...prev.captions, [p]: data.caption },
                          }));
                        })
                      }
                    >
                      {busy === t("generatingFor", { platform: p }) ? <Spinner /> : <Icon name="spark" size={15} />}
                      {busy === t("generatingFor", { platform: p })
                        ? t("generating")
                        : draft.captions[p]
                          ? t("regenerate")
                          : t("generate")}
                    </button>
                  )}
                </div>
                {review ? (
                  <p className="preserve">{draft.captions[p]}</p>
                ) : (
                  <textarea
                    aria-label={t("captionFor", { platform: p })}
                    required
                    maxLength={6000}
                    value={draft.captions[p] || ""}
                    onChange={(e) =>
                      patch({
                        captions: { ...draft.captions, [p]: e.target.value },
                      })
                    }
                    placeholder={t("captionPlaceholder")}
                  />
                )}
              </div>
            ))}
          </div>
        </fieldset>
        <div className="draft-controls">
          {review && (
            <Field label={t("note")}>
              <textarea
                maxLength={noteLength}
                disabled={!!busy}
                value={draft.note || ""}
                onChange={(e) => patch({ note: e.target.value })}
                placeholder={t("notePlaceholder")}
              />
              <small>{t("noteHint")}</small>
            </Field>
          )}
          {review ? (
            <p className="time-line">
              <Icon name="clock" />
              <span>
                {prettyTime(draft.when, locale)}
                <small>{zone}</small>
              </span>
            </p>
          ) : (
            <Field label={t("scheduleFor")}>
              <input
                type="datetime-local"
                disabled={!!busy}
                required
                value={draft.when}
                onChange={(e) => patch({ when: e.target.value })}
              />
              <small>{zone}</small>
            </Field>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            {review && (
              <button
                className="secondary"
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setReview(false);
                  setError("");
                }}
              >
                {t("backToEditing")}
              </button>
            )}
            <button className="primary" disabled={!!busy}>
              {busy && <Spinner />}
              {busy || (review ? t("confirm") : t("review"))}
              <Icon name={review ? "calendar" : "arrow"} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
