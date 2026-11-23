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
