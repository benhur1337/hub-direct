import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { videoLimit, type Asset, type Platform } from "@/lib/model";
import { Problem, problemText, type Translate } from "@/lib/problem";

const paths = {
  arrow: "M4 12h15m-6-6 6 6-6 6",
  back: "M20 12H5m6 6-6-6 6-6",
  plus: "M12 5v14M5 12h14",
  check: "m4 12 5 5L20 6",
  chevron: "m9 5 7 7-7 7",
  calendar:
    "M3 8h18M7 2v4m10-4v4M5 4h14q2 0 2 2v13q0 2-2 2H5q-2 0-2-2V6q0-2 2-2Z",
  folder: "M3 6q0-2 2-2h5l3 3h6q2 0 2 2v9q0 2-2 2H5q-2 0-2-2Z",
  voice: "M5 3h14v18H5ZM8 8h8M8 12h8M8 16h5",
  link: "m8 15-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2 2 1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0m-3-3 6-6",
  compose: "m4 15 11-11 5 5L9 20l-6 1Zm8-8 5 5",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0ZM12 6v6l4 2",
  monitor: "M3 4h18v13H3Zm9 13v4m-5 0h10",
  exit: "M10 3H4v18h6m-1-9h12m-5-5 5 5-5 5",
  upload: "M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5",
  close: "m6 6 12 12M18 6 6 18",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
  week: "M3 4h18v16H3ZM3 9h18M9 9v11m6-11v11",
  dates: "M3 8h18M7 2v4m10-4v4M5 4h14q2 0 2 2v13q0 2-2 2H5q-2 0-2-2V6q0-2 2-2Zm6 10h2v2h-2Z",
  note: "M5 3h10l4 4v14H5ZM14 3v5h5M8 13h8M8 17h5",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  eyeOff: "m3 3 18 18M10.6 5.1Q11.3 5 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7q2.8 0 5-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2",
};
export function Icon({
  name,
  size = 18,
}: {
  name: keyof typeof paths;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
// One brief (centre) reaching three channels (nodes on the ring).
export const supportEmail = "dan@hub-direct.com";
/** Shown beside a busy label; the label itself carries the meaning. */
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="4.5" />
      <circle cx="16" cy="5" r="3" />
      <circle cx="25.53" cy="21.5" r="3" />
      <circle cx="6.47" cy="21.5" r="3" />
    </svg>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <Logo />
      <span>Hub Direct</span>
    </span>
  );
}
export function SiteFooter({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  return (
    <footer className="site-footer wide">
      <div className="footer-signature">
        <Brand />
        <p>{t("tagline")}</p>
        <nav className="footer-legal" aria-label={t("legal")}>
          <Link href="/privacy">{t("privacy")}</Link>
          <Link href="/terms">{t("terms")}</Link>
          <a href={"mailto:" + supportEmail}>{t("contact")}</a>
        </nav>
      </div>
      <div className="footer-links">
        <nav aria-label="Footer navigation">{children}</nav>
        <a className="footer-top" href="#top">
          {t("backToTop")} <Icon name="arrow" size={15} />
        </a>
      </div>
    </footer>
  );
}
export function PlatformMark({ platform }: { platform: Platform }) {
  return (
    <span
      className={"platform-mark " + platform.toLowerCase()}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        {platform === "Facebook" ? (
          <path d="M14 22v-9h3l.5-3.5H14v-2q0-1.8 1.9-1.8H18V2.5q-1.4-.3-3-.3-5.1 0-5.1 5v2.3H7V13h2.9v9Z" />
        ) : platform === "Instagram" ? (
          <g fill="none" stroke="currentColor" strokeWidth="1.9">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r=".65" fill="currentColor" />
          </g>
        ) : (
          <path d="M13 3h3c.4 2.5 1.8 4 4.3 4.4v3a9 9 0 0 1-4.2-1.5v6.7a6.2 6.2 0 1 1-6.3-6.2v3.1a3.1 3.1 0 1 0 3.2 3.1Z" />
        )}
      </svg>
    </span>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Media({ project, asset }: { project: string; asset: Asset }) {
  const src = "/api/workspace?project=" + project + "&asset=" + asset.id;
  return asset.type.startsWith("video/") ? (
    <video src={src} controls preload="metadata" aria-label={asset.name} />
  ) : (
    // Uploaded images require an authenticated session.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={asset.name} loading="lazy" decoding="async" />
  );
}
// Instagram publishing accepts only JPEG photos, so post photos become JPEG before upload; transparency turns white.
export async function asJpeg(file: File) {
  if (file.type !== "image/png" && file.type !== "image/webp") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    return new File([blob], file.name.replace(/\.(png|webp)$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // Too large to decode here: upload the original, which still works everywhere except Instagram.
  }
}
// The pickers take any video; asMp4 turns it into something every channel accepts.
export const mediaAccept = "image/jpeg,image/png,image/webp,video/*";
// iPhone MOV, WebM and videos over 40 MB become H.264 MP4 (Instagram rejects WebM and frames over 1920 px).
export async function asMp4(file: File, onProgress?: (percent: number) => void) {
  if (!file.type.startsWith("video/") || (file.type === "video/mp4" && file.size <= videoLimit)) return file;
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality } =
    await import("mediabunny");
  // The reason in brackets lets a screenshot of the error say what the device could not do.
  const fail = (reason: string) => new Problem("videoConvert", 400, { reason });
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw fail("no video track");
    // Bitrate that lands under the upload limit with 10% headroom after up to 256 kbps copied audio.
    const bitrate = Math.min(6e6, (videoLimit * 8 * 0.9) / (await input.computeDuration()) - 256e3);
    if (bitrate < 1e6) throw new Problem("videoTooLong");
    const scale = Math.min(1, 1920 / Math.max(track.displayWidth, track.displayHeight));
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec: "avc",
        width: Math.round((track.displayWidth * scale) / 2) * 2,
        height: Math.round((track.displayHeight * scale) / 2) * 2,
        fit: "contain",
        quality: new Quality({ bitrate }),
      },
      // No bitrate: AAC audio (every iPhone video) is copied as is, since many iPhones lack WebCodecs audio encoding.
      audio: { codec: "aac" },
    });
    // Extra audio tracks may drop; a missing video or main audio track may not.
    const dropped = conversion.discardedTracks.filter((d) => !d.reason.startsWith("max_track_count"));
    if (!conversion.isValid || dropped.length)
      throw fail(dropped.map((d) => `${d.track.type} ${d.reason}`).join(", ") || "no usable tracks");
    conversion.onProgress = (progress) => onProgress?.(Math.round(progress * 100));
    await conversion.execute();
    return new File([output.target.buffer!], file.name.replace(/\.[^.]*$/, "") + ".mp4", { type: "video/mp4" });
  } catch (error) {
    // Keep this function's own messages; decoder and encoder errors mean the device cannot convert it.
    if (error instanceof Problem) throw error;
    console.error("Video conversion failed", error);
    throw fail(error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : "unknown error");
  } finally {
    input.dispose();
  }
}
/** Post media as every channel accepts it, reporting video conversion progress. */
export function forPosting(files: File[], onConvert: (percent: number) => void) {
  return Promise.all(files.map(async (f) => asMp4(await asJpeg(f), onConvert)));
}
/** Upload box label and bar while media converts or uploads. */
export function UploadStatus({ busy, percent, idle }: { busy: string; percent: number | null; idle: string }) {
  const t = useTranslations("upload");
  if (percent === null)
    return busy === t("uploading") ? <span><Spinner /> {busy}</span> : <span>{idle}</span>;
  return (
    <>
      <span>
        {busy} {percent}%
      </span>
      <progress value={percent} max={100} aria-label={busy} />
    </>
  );
}
/** A date and time in the reader's time zone, written for the page's language (Thai uses the Buddhist calendar). */
export function prettyTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "long",
  }).format(new Date(value));
}
export function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export async function api(body: Record<string, unknown>) {
  const response = await fetch("/api/workspace", {
    method: "POST",
    // The server writes its error messages in this language.
    headers: { "Content-Type": "application/json", "X-Locale": document.documentElement.lang },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw data.error ? new Error(data.error) : new Problem("requestFailed");
  return data;
}
// Files go straight to R2 through signed links: Vercel rejects function requests over 4.5 MB.
export async function uploadMedia(
  project: string,
  files: File[],
  extra: Record<string, unknown> = {},
  onProgress?: (percent: number) => void,
) {
  const { uploads }: { uploads: { asset: Asset; url: string }[] } = await api({
    action: "upload",
    project,
    ...extra,
    files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
  });
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const sent = files.map(() => 0);
  // XMLHttpRequest, not fetch: only it reports upload progress.
  await Promise.all(
    uploads.map(
      ({ asset, url }, i) =>
        new Promise<void>((resolve, reject) => {
          const failed = () => reject(new Problem("uploadFailed"));
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", asset.type);
          xhr.upload.onprogress = (e) => {
            sent[i] = e.loaded;
            onProgress?.(Math.round((sent.reduce((a, b) => a + b, 0) / total) * 100));
          };
          xhr.onload = () => (xhr.status < 300 ? resolve() : failed());
          xhr.onerror = xhr.onabort = xhr.ontimeout = failed;
          xhr.send(files[i]);
        }),
    ),
  );
  const { assets }: { assets: Asset[] } = await api({ action: "attach", project, ...extra, assets: uploads.map((u) => u.asset) });
  return assets;
}
/** Files per upload request; the server checks the same limit. */
const uploadChunk = 10;
/**
 * Uploads any number of library files in groups of ten, converting each first. Each
 * group is saved before the next starts, so a failure keeps everything already uploaded.
 */
export type BatchStep = { step: "converting"; file: number; total: number } | { step: "uploading"; from: number; to: number; total: number };
export async function uploadBatch(
  project: string,
  files: File[],
  onStatus: (status: BatchStep, percent: number | null) => void,
  onAdded: (assets: Asset[]) => void,
) {
  let done = 0;
  for (let start = 0; start < files.length; start += uploadChunk) {
    const group = files.slice(start, start + uploadChunk);
    const ready: File[] = [];
    // One file at a time: several video conversions at once can exhaust a phone's memory.
    for (const file of group)
      ready.push(
        await asMp4(await asJpeg(file), (p) =>
          onStatus({ step: "converting", file: start + ready.length + 1, total: files.length }, p),
        ),
      );
    const uploading = { step: "uploading", from: done + 1, to: done + group.length, total: files.length } as const;
    onStatus(uploading, 0);
    try {
      const added = await uploadMedia(project, ready, { purpose: "library" }, (p) => onStatus(uploading, p));
      done += added.length;
      onAdded(added);
    } catch (error) {
      if (!done) throw error;
      throw new PartialUpload(done, files.length, error);
    }
  }
}
/** Some groups of a batch were saved before one failed. */
export class PartialUpload extends Error {
  constructor(
    readonly done: number,
    readonly total: number,
    readonly cause: unknown,
  ) {
    super("Partial upload");
  }
}
/** Label for an upload batch's progress. */
export function useBatchLabel() {
  const t = useTranslations("upload");
  return (s: BatchStep) =>
    s.step === "converting"
      ? t("convertingOf", { file: s.file, total: s.total })
      : t("uploadingOf", { from: s.from, to: s.to, total: s.total });
}
/**
 * Runs caption requests so they share the prompt cache: the first one runs alone and
 * writes the brand-context cache, then the rest read it, a few at a time. Parallel
 * requests started before the first finishes would each pay to write the cache.
 */
export async function cachedBatch(jobs: (() => Promise<unknown>)[], limit = 4) {
  if (!jobs.length) return [];
  const results: PromiseSettledResult<unknown>[] = await Promise.allSettled([jobs[0]()]);
  let next = 1;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      [results[index]] = await Promise.allSettled([jobs[index]()]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length - 1) }, worker));
  return results;
}
/** Turns any error into text in the page's language. */
export function useErrorText() {
  const t = useTranslations() as unknown as Translate;
  const text = (error: unknown): string =>
    error instanceof Problem
      ? problemText(t, error)
      : error instanceof PartialUpload
        ? t("errors.uploadedSome", { done: error.done, total: error.total, reason: text(error.cause) })
        : error instanceof TypeError
          ? t("errors.offline")
          : error instanceof Error
            ? error.message
            : t("errors.unknown");
  return text;
}
