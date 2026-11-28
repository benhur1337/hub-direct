"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Problem } from "@/lib/problem";
import { allowedTypes, type Asset, type Platform, type Project } from "@/lib/model";
import { api, Field, Icon, localInput, Media, mediaAccept, PlatformMark, uploadBatch, UploadStatus, useBatchLabel, useErrorText, Spinner } from "./ui";

/** Files in one batch; they upload ten at a time. */
const batchLimit = 50;

export function Library({
  project,
  update,
  navigate,
}: {
  project: Project;
  update: (project: Project) => void;
  navigate: (view: "compose" | "channels") => void;
}) {
  const t = useTranslations("library");
  const tUpload = useTranslations("upload");
  const errorText = useErrorText();
  const batchLabel = useBatchLabel();
  const [busy, setBusy] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Brand PDFs live in the same asset list but are not postable media.
  const items = project.assets.filter((a) => allowedTypes.includes(a.type)).reverse();

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
  function replace(asset: Asset) {
    update({ ...project, assets: project.assets.map((a) => (a.id === asset.id ? asset : a)) });
  }
  function startPost(asset: Asset) {
    const key = "draft-" + project.id;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved && JSON.parse(saved).brief && !confirm(t("replaceDraft"))) return;
      sessionStorage.setItem(
        key,
        JSON.stringify({
          id: crypto.randomUUID(),
          brief: asset.description,
          media: [asset.id],
          mediaDescription: asset.description,
          selected: [...project.channels],
          captions: asset.captions || {},
          when: localInput(new Date(Date.now() + 3600000)),
        }),
      );
    } catch {
      /* Storage disabled: open an empty composer. */
    }
    navigate("compose");
  }

  return (
    <div className="compose-layout">
      <div className="compose-heading">
        <h2>{t("title")}</h2>
        <p className="lead">{t("lead", { limit: batchLimit })}</p>
      </div>
      <div className="form-panel">
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
                  },
                );
              });
            }}
          />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!project.channels.length && (
          <p>
            {t.rich("connectForCaptions", {
              link: (chunks) => (
                <button className="text-button" type="button" onClick={() => navigate("channels")}>
                  {chunks}
                </button>
              ),
            })}
          </p>
        )}
        {items.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <ul className="library-list">
            {items.map((a) => {
              const note = notes[a.id] ?? a.description ?? "";
              const label = "caption:" + a.id;
              return (
                <li key={a.id} className="library-item">
                  <div className="media-grid">
                    <Media project={project.id} asset={a} />
                    <span className="filename">{a.name}</span>
                  </div>
                  <div className="draft-column">
                    <Field label={t("describe")}>
                      <textarea
                        maxLength={1000}
                        value={note}
                        disabled={!!busy}
                        onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                        placeholder={t("describePlaceholder")}
                      />
                    </Field>
                    <div className="actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={!!busy || !note.trim() || !project.channels.length}
                        onClick={() =>
                          void work(label, async () => {
                            const data = await api({
                              action: "describe",
                              project: project.id,
                              asset: a.id,
                              description: note,
                            });
                            replace(data.asset);
                          })
                        }
                      >
                        {busy === label ? <Spinner /> : <Icon name="spark" size={15} />}
                        {busy === label ? t("generating") : a.captions ? t("regenerate") : t("generate")}
                      </button>
                      <button type="button" className="primary" disabled={!!busy} onClick={() => startPost(a)}>
                        {t("usePost")}
                        <Icon name="arrow" />
                      </button>
                    </div>
                    {Object.entries(a.captions || {}).map(([p, caption]) => (
                      <div className="caption" key={p}>
                        <div className="caption-head">
                          <span>
                            <PlatformMark platform={p as Platform} />
                            {p}
                          </span>
                        </div>
                        <p className="preserve">{caption}</p>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
