import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import {
  addMedia,
  assetData,
  check,
  createProject,
  deleteProject,
  describeAsset,
  field,
  mediaList,
  Problem,
  projectById,
  selectPlatform,
  sharedAsset,
  updateProject,
  workspace,
} from "@/lib/store";
import {
  allowedTypes,
  brandAssetTypes,
  photoLimit,
  videoLimit,
  type Platform,
  type Project,
} from "@/lib/model";
import { R2ConfigurationError, signedFileUrl, uploadedFile, uploadUrl } from "@/lib/r2";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { problemText, type Translate } from "@/lib/problem";
import { captionRequest } from "@/lib/captions";
import { shareTarget } from "@/lib/publish";
import { newSession, sessionAge, sessionCookie, sessionUser, signIn, signUp } from "@/lib/auth";

function signedIn(req: NextRequest) {
  return sessionUser(req.cookies.get(sessionCookie)?.value);
}
function requireUser(req: NextRequest) {
  const user = signedIn(req);
  check(user, "signInRequired", 401);
  return user;
}
/** Errors are written in the language of the page that called (sent as X-Locale), English otherwise. */
async function failure(req: NextRequest, error: unknown) {
  const header = req.headers.get("x-locale");
  const locale = hasLocale(routing.locales, header) ? header : routing.defaultLocale;
  const t = (await getTranslations({ locale })) as unknown as Translate;
  if (error instanceof Problem)
    return NextResponse.json({ error: problemText(t, error) }, { status: error.status });
  if (error instanceof R2ConfigurationError)
    return NextResponse.json({ error: t("errors.storageConfig") }, { status: 503 });
  console.error(
    "Workspace request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return NextResponse.json({ error: t("errors.server") }, { status: 500 });
}
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    // Signed, expiring media links that Meta fetches when publishing.
    if (params.has("share")) {
      const target = shareTarget(params.get("share") || "");
      check(target, "linkExpired", 404);
      const { project, asset } = await sharedAsset(target.projectId, target.assetId);
      return new Response(await assetData(project, asset), {
        headers: { "Content-Type": asset.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    if (params.has("asset")) {
      const project = await projectById(requireUser(req), params.get("project") || "");
      const asset = project.assets.find((a) => a.id === params.get("asset"));
      check(asset, "attachmentUnavailable", 404);
      // Send the browser straight to R2; files still stored in Neon (or no R2 configured) stream below.
      const link = await signedFileUrl(project.id, asset).catch((error) => {
        if (error instanceof R2ConfigurationError) return undefined;
        throw error;
      });
      // Cached for less than the link's one hour, so a cached redirect never points at an expired link.
      if (link)
        return new Response(null, { status: 302, headers: { Location: link, "Cache-Control": "private, max-age=3000" } });
      return new Response(await assetData(project, asset), {
        headers: {
          "Content-Type": asset.type,
          ...(asset.type === "application/pdf" ? { "Content-Disposition": "attachment" } : {}),
          // Asset ids are random UUIDs and files never change, so the browser may keep them.
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const user = signedIn(req);
    return NextResponse.json(
      {
        signedIn: !!user,
        projects: user ? await workspace(user) : [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return await failure(req, error);
  }
}

function sniff(bytes: Buffer) {
  if (bytes.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
    return "image/png";
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return "image/jpeg";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (
    bytes.toString("ascii", 4, 8) === "ftyp" &&
    /^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV)$/.test(
      bytes.toString("ascii", 8, 12),
    )
  )
    return "video/mp4";
  if (
    bytes.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex")) &&
    bytes.subarray(0, 256).includes("webm")
  )
    return "video/webm";
}
async function limitedBody(req: NextRequest, limit: number) {
  check(
    Number(req.headers.get("content-length") || 0) <= limit,
    "uploadTooLarge",
    413,
  );
  const reader = req.body?.getReader();
  check(reader, "sendBody");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Problem("uploadTooLarge", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
// Files go straight from the browser to R2: Vercel rejects function requests over 4.5 MB.
async function upload(user: string, body: Record<string, unknown>) {
  const project = await projectById(user, String(body.project));
  const types = body.purpose === "brand" ? brandAssetTypes : allowedTypes;
  const files = body.files;
  check(
    Array.isArray(files) && files.length && files.length <= 10,
    "uploadCount",
  );
  const uploads = await Promise.all(
    files.map(async (file) => {
      const type = String(file?.type);
      const size = Number(file?.size);
      check(
        types.includes(type),
        body.purpose === "brand" ? "uploadTypesBrand" : "uploadTypes",
      );
      check(
        Number.isInteger(size) && size > 0 && size <= (type.startsWith("video/") ? videoLimit : photoLimit),
        "uploadSize",
      );
      const asset = { id: randomUUID(), name: String(file.name).slice(0, 255), type };
      return { asset, url: await uploadUrl(project.id, asset, size) };
    }),
  );
  return NextResponse.json({ uploads });
}
async function attach(user: string, body: Record<string, unknown>) {
  const projectId = String(body.project);
  const purpose = body.purpose === "brand" || body.purpose === "library" ? body.purpose : undefined;
  const brandUpload = purpose === "brand";
  const types = brandUpload ? brandAssetTypes : allowedTypes;
  const list = body.assets;
  check(Array.isArray(list) && list.length && list.length <= 10, "uploadCount");
  await projectById(user, projectId);
  const assets = await Promise.all(
    list.map(async (item) => {
      const id = String(item?.id);
      check(/^[0-9a-f-]{36}$/.test(id), "uploadAgain");
      const file = await uploadedFile(projectId, id);
      check(file, "uploadUnfinished");
      const type = String(file.type);
      check(
        types.includes(type) &&
          file.size > 0 &&
          file.size <= (type.startsWith("video/") ? videoLimit : photoLimit),
        "uploadSize",
      );
      check(
        sniff(file.head) === type,
        "contentMismatch",
      );
      return { asset: { id, name: String(item.name).slice(0, 255), type } };
    }),
  );
  await addMedia(user, projectId, assets, body.existing ?? [], purpose);
  return NextResponse.json({ assets: assets.map((item) => item.asset) });
}
async function generate(user: string, body: Record<string, unknown>) {
  const project = await projectById(user, String(body.project));
  const platform = selectPlatform(body.platform);
  check(project.channels.includes(platform), "connectDestination");
  const brief = field(body.brief, "postBrief", 4000);
  const media = mediaList(project, body.media ?? []);
  const mediaDescription = media.length
    ? field(body.mediaDescription, "mediaDescription", 1000)
    : undefined;
  return NextResponse.json({ caption: await writeCaption(project, platform, brief, mediaDescription) });
}
// Library media: one description becomes a caption for every connected channel.
async function describe(user: string, body: Record<string, unknown>) {
  const project = await projectById(user, String(body.project));
  const [asset] = mediaList(project, [body.asset]);
  const description = field(body.description, "mediaSummary", 1000);
  check(project.channels.length, "connectForCaptions");
  // First caption writes the brand-context cache; the rest run in parallel and read it.
  const [first, ...rest] = project.channels;
  const captions = { [first]: await writeCaption(project, first, description, description) };
  await Promise.all(
    rest.map(async (p) => {
      captions[p] = await writeCaption(project, p, description, description);
    }),
  );
  await describeAsset(user, project.id, asset.id, description, captions);
  return NextResponse.json({ asset: { ...asset, description, captions } });
}
async function writeCaption(project: Project, platform: Platform, brief: string, mediaDescription?: string) {
  check(
    process.env.ANTHROPIC_API_KEY?.trim(),
    "anthropicKey",
    503,
  );
  let caption: string | undefined;
  try {
    const response = await new Anthropic({ timeout: 60000 }).beta.messages.create(
      captionRequest(project, platform, brief, mediaDescription),
    );
    console.log("Caption usage", platform, response.usage);
    if (response.stop_reason === "end_turn")
      caption = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
  } catch (error) {
    console.error("Caption generation failed", error instanceof Error ? error.name : "Unknown error");
  }
  check(caption && caption.length <= 6000, "captionUnavailable", 503);
  return caption;
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    check(
      !origin || new URL(origin).host === req.headers.get("host"),
      "wrongOrigin",
      403,
    );
    const contentType = req.headers.get("content-type") || "";
    check(
      contentType.startsWith("application/json"),
      "sendJson",
      415,
    );
    const bytes = await limitedBody(req, 160000);
    let body;
    try {
      body = JSON.parse(bytes.toString());
    } catch {
      throw new Problem("unreadable");
    }
    check(
      body && typeof body === "object" && !Array.isArray(body),
      "chooseAction",
    );
    if (["signin", "signup", "signout"].includes(body.action)) {
      // shortcut: x-forwarded-for is client-set unless a proxy overwrites it; behind one, trust only the proxy's entry.
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
      const user =
        body.action === "signup" ? await signUp(body, ip)
        : body.action === "signin" ? await signIn(body, ip)
        : undefined;
      const reply = NextResponse.json({ ok: true });
      reply.cookies.set(sessionCookie, user ? newSession(user) : "", {
        httpOnly: true,
        sameSite: "strict",
        secure: req.nextUrl.protocol === "https:",
        path: "/",
        maxAge: user ? sessionAge : 0,
      });
      return reply;
    }
    const user = requireUser(req);
    if (body.action === "generate") return await generate(user, body);
    if (body.action === "describe") return await describe(user, body);
    if (body.action === "upload") return await upload(user, body);
    if (body.action === "attach") return await attach(user, body);
    if (body.action === "delete") {
      await deleteProject(user, body.project);
      return NextResponse.json({ ok: true });
    }
    const project =
      body.action === "create"
        ? await createProject(user, body)
        : await updateProject(user, body.project, body);
    return NextResponse.json({ project });
  } catch (error) {
    return await failure(req, error);
  }
}
