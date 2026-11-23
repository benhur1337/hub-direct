import "server-only";
import { and, eq, type SQL } from "drizzle-orm";
import { database } from "./db";
import { connections, media, projects } from "./schema";
import { deleteFile, getFile, putFile, R2ConfigurationError } from "./r2";
import { randomUUID } from "node:crypto";
import { allowedTypes, platforms, type Asset, type Platform, type Project, type Post } from "./model";
import { seal } from "./auth";
import { brandSummary, normalizeProfile } from "./brand-profile";
import { sections as brandSections } from "./brand-fields";

const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export class Problem extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function check(
  value: unknown,
  message: string,
  status = 400,
): asserts value {
  if (!value) throw new Problem(message, status);
}
export function field(value: unknown, label: string, max: number) {
  check(
    typeof value === "string" && value.trim() && value.length <= max,
    `Enter ${label} (up to ${max} characters).`,
  );
  return value.trim();
}
type Change = (
  project: Project,
  tx: Parameters<Parameters<ReturnType<typeof database>["transaction"]>[0]>[0],
) => void | Promise<void>;
// Every query is scoped to the owner, so another account's project reads as missing.
function withProject(owner: string, id: string, change?: Change) {
  check(
    typeof id === "string" && uuid.test(id),
    "Choose an existing project.",
    404,
  );
  return locked(and(eq(projects.id, id), eq(projects.userId, owner))!, change);
}
/** For the publisher, which acts for every owner. */
export function publisherProject(id: string, change: Change) {
  return locked(eq(projects.id, id), change);
}
function locked(where: SQL, change?: Change) {
  return database().transaction(async (tx) => {
    const [project] = await tx
      .select()
      .from(projects)
      .where(where)
      .for("update");
    check(project, "Project unavailable. Choose another project.", 404);
    const delivered = deliverDue(project);
    if (change) await change(project, tx);
    if (delivered || change) {
      const { voice, brand, channels, linked, posts, assets } = project;
      await tx
        .update(projects)
        .set({ voice, brand, channels, linked, posts, assets })
        .where(where);
    }
    return project;
  });
}
export async function createProject(owner: string, body: Record<string, unknown>) {
  const name = field(body.name, "a project name", 100);
  const sections = [
    ["description", "Brand description"],
    ["audience", "Audience"],
    ["tone", "Tone"],
    ["example", "Example copy"],
    ["avoid", "Words to avoid"],
  ] as const;
  let voice = "# " + name + "\n";
  for (const [key, title] of sections) {
    if (!body[key]) continue;
    voice +=
      "\n## " +
      title +
      "\n" +
      field(body[key], title.toLowerCase(), 3000) +
      "\n";
  }
  const project: Project = {
    id: randomUUID(),
    name,
    voice,
    channels: [],
    assets: [],
    posts: [],
  };
  await database().insert(projects).values({ ...project, userId: owner });
  return project;
}
// Neon is the source of truth: drop the row first so a failed R2 cleanup only leaves orphans, never broken links.
export async function deleteProject(owner: string, id: unknown) {
  check(typeof id === "string" && uuid.test(id), "Choose an existing project.", 404);
  const [removed] = await database()
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, owner)))
    .returning({ assets: projects.assets });
  check(removed, "Project unavailable. Refresh the workspace.", 404);
  const results = await Promise.allSettled(
    removed.assets.map((asset) => deleteFile(id, asset.id)),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) console.error(`Project deleted; ${failed} R2 object(s) under projects/${id}/ need manual cleanup.`);
}
export function projectById(owner: string, id: string) {
  return withProject(owner, id);
}

function deliverDue(project: Project) {
  let changed = false;
  for (const post of project.posts) {
    if (Date.parse(post.when) > Date.now()) continue;
    for (const dest of post.destinations) {
      if (dest.status === "Scheduled" && !dest.auto) {
        dest.status = "Delivered";
        changed = true;
      }
    }
  }
  return changed;
}
export async function workspace(owner: string) {
  const rows = await database().select().from(projects).where(eq(projects.userId, owner));
  const current = await Promise.all(
    rows.map((p) => (deliverDue(p) ? projectById(owner, p.id) : p)),
  );
  return current.sort((a, b) => a.name.localeCompare(b.name));
}
export function selectPlatform(value: unknown) {
  const platform = platforms.find((p) => p === value);
  check(platform, "Select a supported destination.");
  return platform;
}
export function mediaList(project: Project, ids: unknown): Asset[] {
  check(
    Array.isArray(ids) && ids.length <= 10 && new Set(ids).size === ids.length,
    "Choose up to ten different photos or one video.",
  );
  const assets = ids.map((id) => {
    const asset = project.assets.find((a) => a.id === id);
    check(asset && allowedTypes.includes(asset.type), "Choose photos or videos uploaded to this project.");
    return asset;
  });
  check(
    !assets.some((a) => a.type.startsWith("video/")) || assets.length === 1,
    "Use one video on its own, or choose photos.",
  );
  return assets;
}
export async function assetData(project: Project, asset: Asset) {
  try {
    const body = await getFile(project.id, asset.id);
    if (body) return body.transformToWebStream();
  } catch (error) {
    if (!(error instanceof R2ConfigurationError)) throw error;
    const data = await legacyAsset(project, asset);
    if (data) return data;
    throw error;
  }
  const data = await legacyAsset(project, asset);
  check(data, "This attachment is unavailable.", 404);
  return data;
}

async function legacyAsset(project: Project, asset: Asset) {
  const [row] = await database()
    .select({ data: media.data })
    .from(media)
    .where(and(eq(media.projectId, project.id), eq(media.id, asset.id)));
  return row && new Uint8Array(row.data);
}
export async function addMedia(
  owner: string,
  id: string,
  assets: { asset: Asset; data: Buffer }[],
  existing: unknown,
  brandUpload = false,
) {
  const project = await projectById(owner, id);
  const added = assets.map((item) => item.asset);
  if (!brandUpload) {
    const previous = mediaList(project, existing);
    project.assets.push(...added);
    mediaList(project, [...previous, ...added].map(asset => asset.id));
  }
  const uploaded: string[] = [];
  try {
    for (const { asset, data } of assets) {
      await putFile(id, asset, data);
      uploaded.push(asset.id);
    }
    await withProject(owner, id, (current) => {
      current.assets.push(...added);
    });
  } catch (error) {
    if (uploaded.length) {
      // A lost COMMIT response can leave a successful upload referenced in Postgres.
      const current = await projectById(owner, id);
      for (const assetId of uploaded) {
        if (!current.assets.some((asset) => asset.id === assetId))
          await deleteFile(id, assetId);
      }
    }
    throw error;
  }
}
export function describeAsset(
  owner: string,
  id: string,
  assetId: unknown,
  description: string,
  captions: Asset["captions"],
) {
  return withProject(owner, id, (project) => {
    const asset = project.assets.find((a) => a.id === assetId);
    check(asset && allowedTypes.includes(asset.type), "This media is no longer in the library.", 404);
    asset.description = description;
    asset.captions = captions;
  });
}
function future(value: unknown) {
  check(
    typeof value === "string" &&
      Number.isFinite(Date.parse(value)) &&
      Date.parse(value) > Date.now(),
    "Choose a date and time in the future.",
  );
  return new Date(value).toISOString();
}
export function updateProject(owner: string, id: string, body: Record<string, unknown>) {
  return withProject(owner, id, async (project, tx) => {
    applyAction(project, body);
    if (body.action === "disconnect")
      await tx
        .delete(connections)
        .where(and(eq(connections.projectId, project.id), eq(connections.platform, selectPlatform(body.platform))));
  });
}
/** Saves accounts from Meta login and turns on automatic publishing for them. */
export function linkAccounts(
  owner: string,
  id: string,
  accounts: { platform: Platform; accountId: string; name: string; token: string }[],
) {
  return withProject(owner, id, async (project, tx) => {
    for (const { platform, accountId, name, token } of accounts) {
      const row = { projectId: project.id, platform, accountId, token: seal(token) };
      await tx
        .insert(connections)
        .values(row)
        .onConflictDoUpdate({ target: [connections.projectId, connections.platform], set: row });
      project.linked = { ...project.linked, [platform]: name };
      if (!project.channels.includes(platform)) project.channels.push(platform);
    }
  });
}
export async function sharedAsset(projectId: string, assetId: string) {
  const [row] = await database()
    .select({ id: projects.id, assets: projects.assets })
    .from(projects)
    .where(eq(projects.id, projectId));
  const asset = row?.assets.find((a) => a.id === assetId);
  check(row && asset, "This attachment is unavailable.", 404);
  return { project: row as Project, asset };
}

function applyAction(project: Project, body: Record<string, unknown>) {
  switch (body.action) {
    case "brand": {
      const revision = project.brand?.revision ?? 0;
      check(body.revision === revision, "This profile changed in another tab. Reopen Brand voice before saving.", 409);
      check(body.status === "draft" || body.status === "completed", "Choose a valid profile status.");
      const step = body.step;
      check(typeof step === "number" && Number.isInteger(step) && step >= 0 && step <= brandSections.length, "Choose a valid onboarding step.");
      const completed = body.status === "completed";
      const profile = normalizeProfile(body.profile, project.assets, completed);
      if (completed) {
        project.brand = { revision: revision + 1, step: brandSections.length, completed: profile };
        project.voice = brandSummary(profile, project.assets);
      } else {
        project.brand = { ...project.brand, revision: revision + 1, step, draft: profile };
      }
      return;
    }
    case "voice":
      project.voice = field(body.voice, "your brand voice", 24000);
      if (project.brand) {
        for (const profile of [project.brand.completed, project.brand.draft]) {
          if (profile) (profile.brand_voice ??= {}).previous = project.voice;
        }
        project.brand.revision++;
      }
      return;
    case "connect": {
      const platform = selectPlatform(body.platform);
      if (!project.channels.includes(platform)) project.channels.push(platform);
      break;
    }
    case "disconnect": {
      const platform = selectPlatform(body.platform);
      project.channels = project.channels.filter((p) => p !== platform);
      if (project.linked) delete project.linked[platform];
      break;
    }
    case "schedule": {
      const brief = field(body.brief, "a post brief", 4000);
      const media = mediaList(project, body.media).map((a) => a.id);
      check(
        body.captions &&
          typeof body.captions === "object" &&
          !Array.isArray(body.captions),
        "Choose at least one connected destination.",
      );
      const destinations: Post["destinations"] = Object.entries(
        body.captions,
      ).map(([key, value]) => {
        const platform = selectPlatform(key);
        check(
          project.channels.includes(platform),
          "Connect the selected channel first.",
        );
        const auto = !!project.linked?.[platform];
        if (auto && platform === "Instagram")
          check(
            media.length &&
              media.every((id) =>
                ["image/jpeg", "video/mp4"].includes(project.assets.find((a) => a.id === id)!.type),
              ),
            "Instagram publishing needs JPEG photos or one MP4 video. Change the media or remove Instagram.",
          );
        return {
          platform,
          caption: field(value, "a caption for " + platform, 6000),
          status: "Scheduled",
          ...(auto ? { auto } : {}),
        };
      });
      check(destinations.length, "Choose at least one connected destination.");
      // The draft ID makes confirmation safe to retry after a lost response.
      check(
        typeof body.draftId === "string" && uuid.test(body.draftId),
        "Reopen the composer and try again.",
      );
      if (project.posts.some((post) => post.id === body.draftId)) return;
      project.posts.push({
        id: body.draftId,
        when: future(body.when),
        brief,
        media,
        destinations,
      });
      break;
    }
    case "cancel":
    case "reschedule": {
      const post = project.posts.find((p) => p.id === body.postId);
      check(post, "Choose an existing post.", 404);
      check(
        post.destinations.every((d) => d.status === "Scheduled"),
        "This post is already closed. Refresh the schedule.",
        409,
      );
      if (body.action === "reschedule") post.when = future(body.when);
      else
        post.destinations.forEach((d) => {
          d.status = "Canceled";
        });
      break;
    }
    default:
      throw new Problem("Choose a supported workspace action.");
  }
  project.posts.sort((a, b) => a.when.localeCompare(b.when));
}
