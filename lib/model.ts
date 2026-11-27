import type { SavedBrand } from "./brand-profile";

export const platforms = ["Facebook", "Instagram", "TikTok"] as const;
export type Platform = (typeof platforms)[number];
export type Status = "Scheduled" | "Delivered" | "Canceled" | "Publishing" | "Published" | "Failed";
export type Asset = {
  id: string;
  name: string;
  type: string;
  description?: string;
  captions?: Partial<Record<Platform, string>>;
};
export type Destination = {
  platform: Platform;
  caption: string;
  status: Status;
  /** Sent by the publisher through a linked account instead of posted by hand. */
  auto?: boolean;
  container?: string;
  url?: string;
  error?: string;
};
export type Post = {
  id: string;
  brief: string;
  when: string;
  media: string[];
  destinations: Destination[];
};
/**
 * Editorial feedback kept with the brand voice. Every caption request sends the
 * whole list, in its own cached block after the brand profile.
 */
export type EditorialNote = {
  id: string;
  text: string;
  at: string;
  /** The post the note was written about, when it came from the composer or schedule. */
  postId?: string;
  /** Set when the note is about one destination; captions for other channels ignore it. */
  platform?: Platform;
  /** The start of the caption it refers to, so the note keeps its meaning. */
  caption?: string;
};
export const noteLength = 500;
export const noteLimit = 40;
export type Project = {
  id: string;
  name: string;
  voice: string;
  brand?: SavedBrand | null;
  channels: Platform[];
  /** Account names linked for automatic publishing; tokens live in the connections table. */
  linked?: Partial<Record<Platform, string>> | null;
  assets: Asset[];
  posts: Post[];
  editorial?: EditorialNote[] | null;
};
export const photoLimit = 8 * 1024 * 1024;
export const videoLimit = 40 * 1024 * 1024;
export const allowedTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/webm",
];
export const brandAssetTypes = [...allowedTypes, "application/pdf"];
