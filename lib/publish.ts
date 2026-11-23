import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { database } from "./db";
import { connections, projects } from "./schema";
import { publisherProject } from "./store";
import { same, sign, unseal } from "./auth";
import type { Asset, Destination, Platform, Post } from "./model";

const version = "v24.0";
// META_GRAPH_URL exists only so scripts/check-scheduler.mjs can point at a stub.
const graphBase = () => (process.env.META_GRAPH_URL || "https://graph.facebook.com") + "/" + version;

export class GraphError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}
/** Calls the Graph API; params go in the body for POST and the query for GET. */
export async function graph(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST") {
  const query = new URLSearchParams(params);
  const response = await fetch(graphBase() + path + (method === "GET" ? "?" + query : ""), {
    method,
    ...(method === "POST" ? { body: query } : {}),
    signal: AbortSignal.timeout(50000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error)
    throw new GraphError(String(data.error?.message ?? "Meta returned HTTP " + response.status).slice(0, 300), data.error?.code);
  return data;
}

/** A one-hour link Meta can fetch the media from. */
function shareUrl(projectId: string, assetId: string) {
  const base = process.env.APP_URL;
  if (!base) throw new GraphError("Set APP_URL so Meta can fetch the media.");
  const payload = projectId + "." + assetId + "." + (Date.now() + 3600000);
  return new URL("/api/workspace?share=" + payload + "." + sign("share:" + payload), base).href;
}
export function shareTarget(token: string) {
  const [projectId, assetId, expires, signature] = token.split(".");
  if (!signature || !(Number(expires) > Date.now())) return;
  if (same(sign("share:" + projectId + "." + assetId + "." + expires), signature)) return { projectId, assetId };
}

type Job = { projectId: string; postId: string; platform: Platform };
const isDue = (post: Post, d: Destination) =>
  d.auto && ((d.status === "Scheduled" && Date.parse(post.when) <= Date.now()) || (d.status === "Publishing" && d.container));

/** Publishes every due destination. One run at a time, so a post is never sent twice by overlapping runs. */
export async function publishDue() {
  return database().transaction(async (tx) => {
    const {
      rows: [lock],
    } = await tx.execute<{ ok: boolean }>(sql`select pg_try_advisory_xact_lock(7241) as ok`);
    if (!lock.ok) return 0;
    // shortcut: scans every project row; give posts their own table once there are thousands of projects.
    const rows = await database().select({ id: projects.id, posts: projects.posts }).from(projects);
    const jobs: Job[] = rows.flatMap((p) =>
      p.posts.flatMap((post) =>
        post.destinations.filter((d) => isDue(post, d)).map((d) => ({ projectId: p.id, postId: post.id, platform: d.platform })),
      ),
    );
    for (const job of jobs) await run(job);
    return jobs.length;
  });
}

async function run({ projectId, postId, platform }: Job) {
  // Claim inside the row lock: from here on the destination is never re-sent automatically.
  let claimed: { post: Post; dest: Destination; assets: Asset[] } | undefined;
  await publisherProject(projectId, (project) => {
    const post = project.posts.find((p) => p.id === postId);
    const dest = post?.destinations.find((d) => d.platform === platform);
    if (!post || !dest || !isDue(post, dest)) return;
    dest.status = "Publishing";
    claimed = { post, dest: { ...dest }, assets: post.media.map((id) => project.assets.find((a) => a.id === id)!) };
  });
  if (!claimed) return;
  let result: Partial<Destination>;
  try {
    const [account] = await database()
      .select()
      .from(connections)
      .where(and(eq(connections.projectId, projectId), eq(connections.platform, platform)));
    if (!account) throw new GraphError("Account not linked", 190);
    const token = unseal(account.token);
    const media = claimed.assets.map((a) => ({ type: a.type, url: shareUrl(projectId, a.id) }));
    result =
      platform === "Facebook"
        ? await facebook(account.accountId, token, claimed.dest.caption, media)
        : await instagram(account.accountId, token, claimed.dest, media);
  } catch (error) {
    const code = error instanceof GraphError ? error.code : undefined;
    console.error("Publishing failed", platform, error instanceof Error ? error.message : "Unknown error");
    result = {
      status: "Failed",
      error:
        code === 190
          ? `Reconnect ${platform} in Channels, then schedule the post again.`
          : error instanceof GraphError
            ? error.message
            : "Publishing failed. Check the post on " + platform + " before scheduling it again.",
    };
  }
  await publisherProject(projectId, (project) => {
    const dest = project.posts.find((p) => p.id === postId)?.destinations.find((d) => d.platform === platform);
    if (dest) Object.assign(dest, result);
  });
}

type Media = { type: string; url: string };
async function facebook(page: string, token: string, caption: string, media: Media[]): Promise<Partial<Destination>> {
  const auth = { access_token: token };
  let id: string;
  if (media[0]?.type.startsWith("video/"))
    id = (await graph(`/${page}/videos`, { ...auth, file_url: media[0].url, description: caption })).id;
  else if (media.length === 1)
    id = (await graph(`/${page}/photos`, { ...auth, url: media[0].url, caption })).post_id;
  else {
    const photos = [];
    for (const m of media) photos.push((await graph(`/${page}/photos`, { ...auth, url: m.url, published: "false" })).id);
    id = (
      await graph(`/${page}/feed`, {
        ...auth,
        message: caption,
        ...Object.fromEntries(photos.map((p, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: p })])),
      })
    ).id;
  }
  return { status: "Published", url: "https://www.facebook.com/" + id };
}

// Instagram processes media asynchronously: create a container, then publish it on a later run.
async function instagram(user: string, token: string, dest: Destination, media: Media[]): Promise<Partial<Destination>> {
  const auth = { access_token: token };
  if (!dest.container) {
    let container: string;
    if (media[0].type.startsWith("video/"))
      container = (await graph(`/${user}/media`, { ...auth, media_type: "REELS", video_url: media[0].url, caption: dest.caption })).id;
    else if (media.length === 1)
      container = (await graph(`/${user}/media`, { ...auth, image_url: media[0].url, caption: dest.caption })).id;
    else {
      const children = [];
      for (const m of media)
        children.push((await graph(`/${user}/media`, { ...auth, image_url: m.url, is_carousel_item: "true" })).id);
      container = (
        await graph(`/${user}/media`, { ...auth, media_type: "CAROUSEL", children: children.join(","), caption: dest.caption })
      ).id;
    }
    return { status: "Publishing", container };
  }
  const { status_code } = await graph(`/${dest.container}`, { ...auth, fields: "status_code" }, "GET");
  if (status_code === "IN_PROGRESS") return { status: "Publishing" };
  if (status_code === "PUBLISHED") return { status: "Published" };
  if (status_code !== "FINISHED")
    return { status: "Failed", error: "Instagram could not process this media (" + status_code + ")." };
  const { id } = await graph(`/${user}/media_publish`, { ...auth, creation_id: dest.container });
  const { permalink } = await graph(`/${id}`, { ...auth, fields: "permalink" }, "GET").catch(() => ({}));
  return { status: "Published", ...(permalink ? { url: permalink } : {}) };
}
