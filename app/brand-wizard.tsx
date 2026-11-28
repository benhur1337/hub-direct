"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Problem } from "@/lib/problem";
import { sections, type BrandField } from "@/lib/brand-fields";
import {
  answerText,
  BrandInputError,
  initialProfile,
  normalizeProfile,
  strings,
  type Answer,
  type BrandProfile,
} from "@/lib/brand-profile";
import { brandAssetTypes, photoLimit, videoLimit, type Project } from "@/lib/model";
import { api, Icon, uploadMedia, useErrorText, Spinner } from "./ui";
import { BrandInput, useBrandText } from "./brand-input";
import "./brand-wizard.css";

const reviewStep = sections.length;

export function BrandWizard({
  project,
  update,
}: {
  project: Project;
  update: (p: Project) => void;
}) {
  const t = useTranslations("brand");
  const bt = useBrandText();
  const errorText = useErrorText();
  const titles = [...sections.map((_, i) => bt.section(i)), t("reviewStep")];
  const saved = project.brand;
  const startingProfile =
    saved?.draft ?? saved?.completed ?? initialProfile(project.name, project.voice);
  const [profile, setProfile] = useState<BrandProfile>(startingProfile);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [editing, setEditing] = useState(!saved?.completed || !!saved.draft);
  const [returnToReview, setReturnToReview] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(saved?.revision ?? 0);
  const heading = useRef<HTMLHeadingElement>(null);
  const section = sections[step];
  const reviewing = step === reviewStep;
  const active = strings(profile.social_platforms?.active);
  function move(next: number, fromReview = false) {
    setStep(next);
    setEditing(true);
    setReturnToReview(fromReview);
    setStatus("");
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  function change(f: BrandField, value: Answer) {
    setProfile((old) => ({ ...old, [f.group]: { ...old[f.group], [f.key]: value } }));
    setStatus("");
    setError("");
  }
  async function upload(f: BrandField, files: File[]) {
    setError("");
    setStatus("");
    setBusy(t("uploading"));
    try {
      const ids = strings(profile.visual_identity?.assets);
      if (files.length > 10 || (f.kind === "assets" && files.length + ids.length > 40))
        throw new Problem("brandUploadCount");
      for (const file of files) {
        if (
          !brandAssetTypes.includes(file.type) ||
          (f.kind === "logo" && !file.type.startsWith("image/"))
        )
          throw new Problem("brandUploadType");
        if (!file.size || file.size > (file.type.startsWith("video/") ? videoLimit : photoLimit))
          throw new Problem("brandUploadSize");
      }
      const assets = await uploadMedia(project.id, files, { purpose: "brand" });
      update({ ...project, assets: [...project.assets, ...assets] });
      change(f, f.kind === "logo" ? assets[0].id : [...ids, ...assets.map((a) => a.id)]);
      setStatus(t("uploaded"));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  function invalid(e: unknown) {
    if (e instanceof BrandInputError && e.step !== step) move(e.step, reviewing);
    setError(errorText(e));
  }
  async function save(complete: boolean) {
    setError("");
    setStatus("");
    try {
      const clean = normalizeProfile(profile, project.assets, complete);
      setBusy(t("saving"));
      const { project: next }: { project: Project } = await api({
        action: "brand",
        project: project.id,
        profile: clean,
        step,
        revision,
        status: complete ? "completed" : "draft",
      });
      update(next);
      setRevision(next.brand!.revision);
      setProfile(clean);
      setEditing(!complete);
      setStatus(complete ? t("profileSaved") : t("draftSaved"));
    } catch (e) {
      invalid(e);
    } finally {
      setBusy("");
    }
  }
  function next() {
    if (reviewing) {
      void save(true);
      return;
    }
    try {
      const current: BrandProfile = {};
      for (const f of section.fields) {
        const v = profile[f.group]?.[f.key];
        if (v !== undefined) (current[f.group] ??= {})[f.key] = v;
      }
      normalizeProfile(current, project.assets, step === 0);
      move(returnToReview ? reviewStep : step + 1);
    } catch (e) {
      invalid(e);
    }
  }
  const visible =
    section?.fields.filter(
      (f) =>
        (f.kind !== "platformNotes" || active.length > 0) &&
        (f.key !== "previous" || !!startingProfile.brand_voice?.previous),
    ) ?? [];
  function input(f: BrandField) {
    return (
      <BrandInput
        key={f.group + "." + f.key}
        f={f}
        value={profile[f.group]?.[f.key]}
        onChange={(v) => change(f, v)}
        project={project}
        platforms={active}
        upload={(files) => void upload(f, files)}
      />
    );
  }
  return (
    <div className="form-layout brand-wizard">
      <aside>
        <span className="desk-mark">
          <Icon name="voice" size={22} />
        </span>
        <h2>{t("title")}</h2>
        <p className="lead">{t("lead")}</p>
        <nav aria-label={t("sections")} className="brand-steps">
          {titles.map((title, i) => (
            <button
              key={title}
              type="button"
              aria-current={step === i ? "step" : undefined}
              disabled={!!busy}
              onClick={() => move(i, reviewing && i !== reviewStep)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {title}
            </button>
          ))}
        </nav>
        <label className="field brand-jump">
          <span>{t("goTo")}</span>
          <select
            value={step}
            disabled={!!busy}
            onChange={(e) => move(Number(e.target.value), reviewing)}
          >
            {titles.map((title, i) => (
              <option value={i} key={title}>
                {i + 1}. {title}
              </option>
            ))}
          </select>
        </label>
      </aside>
      <form
        className="form-panel brand-sheet"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && editing) next();
        }}
      >
        <div className="brand-progress">
          <span className="section-label">
            {t("step", { step: step + 1, total: titles.length })}
          </span>
          <progress value={step + 1} max={titles.length} aria-label={t("progress")} />
        </div>
        <h3 tabIndex={-1} ref={heading}>
          {reviewing && !editing ? t("savedTitle") : titles[step]}
        </h3>
        <p>{section ? bt.sectionHint(step) : editing ? t("reviewHint") : t("savedHint")}</p>
        <fieldset disabled={!!busy} key={step} className="brand-fields">
          <legend className="brand-sr">{titles[step]}</legend>
          {reviewing ? (
            sections.map((s, i) => {
              const entries = s.fields
                .map((f) => ({
                  f,
                  answer: answerText(f, profile, project.assets, bt.option),
                }))
                .filter((v) => v.answer);
              return (
                <section className="brand-review" key={s.title}>
                  <div>
                    <h4>{bt.section(i)}</h4>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={t("editSection", { section: bt.section(i) })}
                      onClick={() => move(i, true)}
                    >
                      {t("edit")}
                    </button>
                  </div>
                  {entries.length ? (
                    <dl>
                      {entries.map(({ f, answer }) => (
                        <div key={f.group + f.key}>
                          <dt>{bt.label(f)}</dt>
                          <dd>{answer}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p>{t("noDetails")}</p>
                  )}
                </section>
              );
            })
          ) : (
            <>
              {visible.filter((f) => !f.advanced).map(input)}
              {visible.some((f) => f.advanced) && (
                <details className="brand-advanced">
                  <summary>{t("advanced")}</summary>
                  <div>{visible.filter((f) => f.advanced).map(input)}</div>
                </details>
              )}
            </>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {busy && <p role="status"><Spinner /> {busy}</p>}
        {editing && (
          <div className="brand-actions">
            <button
              type="button"
              className="secondary"
              disabled={!!busy}
              onClick={() => void save(false)}
            >
              {t("saveDraft")}
            </button>
            <div className="actions">
              {step > 0 && (
                <button
                  type="button"
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => move(step - 1)}
                >
                  {t("back")}
                </button>
              )}
              {!reviewing && (
                <button
                  type="button"
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => move(returnToReview ? reviewStep : step + 1)}
                >
                  {t("skip")}
                </button>
              )}
              <button type="submit" className="primary" disabled={!!busy}>
                {reviewing
                  ? t("saveProfile")
                  : returnToReview
                    ? t("returnToReview")
                    : step === reviewStep - 1
                      ? t("reviewStep")
                      : t("next")}
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
