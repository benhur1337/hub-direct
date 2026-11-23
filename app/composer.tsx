"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  allowedTypes,
  platforms,
  type Platform,
  type Project,
  type Asset,
} from "@/lib/model";
import {
  api,
  asJpeg,
  Field,
  Icon,
  localInput,
  Media,
  message,
  PlatformMark,
  prettyTime,
} from "./ui";

type Draft = {
  id: string;
  brief: string;
  media: string[];
  mediaDescription?: string;
  selected: Platform[];
  captions: Partial<Record<Platform, string>>;
  when: string;
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
  const [draft, setDraft] = useState(() => readDraft(project));
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState("");
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
      setError(message(err));
    } finally {
      setBusy("");
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
      throw new Error("Choose a date and time in the future.");
    if (localInput(date) !== draft.when)
      throw new Error(
        "This local time falls in a clock change. Choose another time.",
      );
    return date.toISOString();
  }
  if (!project.channels.length)
    return (
      <section className="compose-intro">
        <h2>Compose a post</h2>
        <p>Choose a channel for your first draft.</p>
        <button className="primary" onClick={() => navigate("channels")}>
          Connect channels
          <Icon name="arrow" />
        </button>
      </section>
    );
  return (
    <div className="compose-layout">
      <div className="compose-heading">
        <h2>{review ? "Review your post" : "Compose a post"}</h2>
        <p className="lead">
          {review
            ? "Check the captions, media order, and time before scheduling."
            : "Start with a brief, then tailor the caption for each destination."}
        </p>
      </div>
      <form
        className="form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          void work(review ? "Scheduling…" : "Reviewing…", async () => {
            const when = checkTime();
            if (!draft.selected.length)
              throw new Error("Select at least one destination.");
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
          aria-label={review ? "Post details to review" : "Post content"}
          tabIndex={review ? 0 : undefined}
          disabled={!!busy}
          key={review ? "review" : "edit"}
        >
          <div className="draft-column">
            {review ? (
              <h3>{draft.brief}</h3>
            ) : (
              <>
                <Field label="Post brief">
                  <textarea
                    required
                    maxLength={4000}
                    value={draft.brief}
                    onChange={(e) => patch({ brief: e.target.value })}
                    placeholder="What would you like this post to say?"
                  />
                </Field>
                <div className="field">
                  <span>
                    Media <small>Optional</small>
                  </span>
                  <div className="upload">
                    <Icon name="upload" size={23} />
                    <span>
                      {busy === "Uploading…"
                        ? busy
                        : "Choose photos or a video"}
                    </span>
                    <small>
                      {assets.length
                        ? assets.length + " attached · add more, up to 10 photos or 1 video"
                        : "Up to 10 photos (8 MB each) or 1 video (40 MB)"}
                    </small>
                    <input
                      aria-label="Upload media"
                      type="file"
                      accept={allowedTypes.join(",")}
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        e.target.value = "";
                        if (!files.length) return;
                        void work("Uploading…", async () => {
                          const form = new FormData();
                          form.set("project", project.id);
                          draft.media.forEach((id) =>
                            form.append("existing", id),
                          );
                          for (const f of await Promise.all(files.map(asJpeg)))
                            form.append("files", f);
                          const { assets: added }: { assets: Asset[] } =
                            await api(form);
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
              <ol className="media-grid" aria-label="Attachment order">
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
                          aria-label={"Move " + a.name + " earlier"}
                          disabled={!i}
                          onClick={() => move(i, -1)}
                        >
                          <Icon name="back" size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={"Move " + a.name + " later"}
                          disabled={i === assets.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <Icon name="arrow" size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={"Remove " + a.name}
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
              <Field label="Describe the media">
                <textarea
                  required
                  maxLength={1000}
                  value={draft.mediaDescription || ""}
                  onChange={(e) => patch({ mediaDescription: e.target.value })}
                  placeholder="e.g. Two baristas pouring latte art at the new counter, morning light."
                />
                <small>A sentence or two. Generated captions only mention what you describe here.</small>
              </Field>
            )}
            {!review && (
              <div className="field">
                <span>Destinations</span>
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
                title={describe ? "Describe the media first" : undefined}
                onClick={() =>
                  void work("Generating all", async () => {
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
                    // The first request writes the brand-context cache; parallel ones would all miss it.
                    const [first, ...rest] = draft.selected;
                    const results = [
                      ...(await Promise.allSettled([one(first)])),
                      ...(await Promise.allSettled(rest.map(one))),
                    ];
                    const failed = results.find((r) => r.status === "rejected");
                    if (failed) throw failed.reason;
                  })
                }
              >
                <Icon name="spark" size={15} />
                {busy === "Generating all"
                  ? "Generating all captions…"
                  : "Generate captions for all platforms"}
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
                      title={describe ? "Describe the media first" : undefined}
                      onClick={() =>
                        void work("Generating " + p, async () => {
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
                      <Icon name="spark" size={15} />
                      {busy === "Generating " + p
                        ? "Generating…"
                        : draft.captions[p]
                          ? "Regenerate"
                          : "Generate caption"}
                    </button>
                  )}
                </div>
                {review ? (
                  <p className="preserve">{draft.captions[p]}</p>
                ) : (
                  <textarea
                    aria-label={p + " caption"}
                    required
                    maxLength={6000}
                    value={draft.captions[p] || ""}
                    onChange={(e) =>
                      patch({
                        captions: { ...draft.captions, [p]: e.target.value },
                      })
                    }
                    placeholder="Write a caption or generate one from your brief."
                  />
                )}
              </div>
            ))}
          </div>
        </fieldset>
        <div className="draft-controls">
          {review ? (
            <p className="time-line">
              <Icon name="clock" />
              <span>
                {prettyTime(draft.when)}
                <small>{zone}</small>
              </span>
            </p>
          ) : (
            <Field label="Schedule for">
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
                Back to editing
              </button>
            )}
            <button className="primary" disabled={!!busy}>
              {busy || (review ? "Confirm schedule" : "Review post")}
              <Icon name={review ? "calendar" : "arrow"} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
