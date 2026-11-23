import type { ReactNode } from "react";
import type { Asset, Platform } from "@/lib/model";

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
      <span>Hub Connect</span>
    </span>
  );
}
export function SiteFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="site-footer wide">
      <div className="footer-signature">
        <Brand />
        <p>One brief. Three channels.</p>
      </div>
      <div className="footer-links">
        <nav aria-label="Footer navigation">{children}</nav>
        <a className="footer-top" href="#top">
          Back to top <Icon name="arrow" size={15} />
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
export function prettyTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "long",
  }).format(new Date(value));
}
export function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export async function api(body: Record<string, unknown> | FormData) {
  const form = body instanceof FormData;
  const response = await fetch("/api/workspace", {
    method: "POST",
    headers: form ? undefined : { "Content-Type": "application/json" },
    body: form ? body : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || "The request failed. Try again.");
  return data;
}
export function message(error: unknown) {
  return error instanceof TypeError
    ? "Could not reach the workspace. Check your connection and try again."
    : error instanceof Error
      ? error.message
      : "Something went wrong. Try again.";
}
