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
import { R2ConfigurationError, signedFileUrl } from "@/lib/r2";
import { brandContext, BrandInputError } from "@/lib/brand-profile";
import { shareTarget } from "@/lib/publish";
import { newSession, sessionAge, sessionCookie, sessionUser, signIn, signUp } from "@/lib/auth";

function signedIn(req: NextRequest) {
  return sessionUser(req.cookies.get(sessionCookie)?.value);
}
function requireUser(req: NextRequest) {
  const user = signedIn(req);
  check(user, "Sign in to open the workspace.", 401);
  return user;
}
function failure(error: unknown) {
  if (error instanceof BrandInputError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof R2ConfigurationError)
    return NextResponse.json({ error: error.message }, { status: 503 });
  if (error instanceof Problem)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error(
    "Workspace request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return NextResponse.json(
    {
      error:
        "The workspace could not be saved or opened. Check the storage connection and retry.",
    },
    { status: 500 },
  );
}
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    // Signed, expiring media links that Meta fetches when publishing.
    if (params.has("share")) {
      const target = shareTarget(params.get("share") || "");
      check(target, "This link has expired.", 404);
      const { project, asset } = await sharedAsset(target.projectId, target.assetId);
      return new Response(await assetData(project, asset), {
        headers: { "Content-Type": asset.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    if (params.has("asset")) {
      const project = await projectById(requireUser(req), params.get("project") || "");
      const asset = project.assets.find((a) => a.id === params.get("asset"));
      check(asset, "This attachment is unavailable.", 404);
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
    return failure(error);
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
    "This upload is too large. Choose smaller files.",
    413,
  );
  const reader = req.body?.getReader();
  check(reader, "Send a request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Problem("This upload is too large. Choose smaller files.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function upload(user: string, req: NextRequest, contentType: string) {
  const bytes = await limitedBody(req, 10 * photoLimit + 128 * 1024);
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(bytes), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new Problem("Upload could not be read. Select the files again.");
  }
  const files = form.getAll("files");
  const brandUpload = form.get("purpose") === "brand";
  const types = brandUpload ? brandAssetTypes : allowedTypes;
  check(
    files.length && files.length <= 10,
    "Choose up to ten photos or one video.",
  );
  const assets = await Promise.all(
    files.map(async (file) => {
      check(
        file instanceof File && types.includes(file.type),
        brandUpload ? "Choose a JPEG, PNG, WebP, MP4, WebM, or PDF file." : "Choose JPEG, PNG, WebP, MP4, or WebM files.",
      );
      check(
        file.size > 0 &&
          file.size <=
            (file.type.startsWith("video/") ? videoLimit : photoLimit),
        "Use photos up to 8 MB or a video up to 40 MB.",
      );
      const data = Buffer.from(await file.arrayBuffer());
      check(
        sniff(data) === file.type,
        "The file contents do not match its type. Export the media again.",
      );
      return {
        asset: {
          id: randomUUID(),
          name: file.name.slice(0, 255),
          type: file.type,
        },
        data,
      };
    }),
  );
  await addMedia(user, String(form.get("project")), assets, form.getAll("existing"), brandUpload);
  return NextResponse.json({ assets: assets.map((item) => item.asset) });
}
async function generate(user: string, body: Record<string, unknown>) {
  const project = await projectById(user, String(body.project));
  const platform = selectPlatform(body.platform);
  check(project.channels.includes(platform), "Connect the destination first.");
  const brief = field(body.brief, "a post brief", 4000);
  const media = mediaList(project, body.media ?? []);
  const mediaDescription = media.length
    ? field(body.mediaDescription, "a short description of the attached media", 1000)
    : undefined;
  return NextResponse.json({ caption: await writeCaption(project, platform, brief, mediaDescription) });
}
// Library media: one description becomes a caption for every connected channel.
async function describe(user: string, body: Record<string, unknown>) {
  const project = await projectById(user, String(body.project));
  const [asset] = mediaList(project, [body.asset]);
  const description = field(body.description, "a short description of the media", 1000);
  check(project.channels.length, "Connect a channel before generating captions.");
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
  // Brand context minus platform notes is identical for every platform, so it forms the cached prefix.
  const shared = brandContext(project, "");
  const guidelines = brandContext(project, platform).data.preferences?.social_platforms?.guidelines;
  check(
    process.env.ANTHROPIC_API_KEY?.trim(),
    "Set ANTHROPIC_API_KEY in .env.local and restart, or enter your caption below.",
    503,
  );
  const unavailable =
    "Caption generation is unavailable. Retry or edit the caption manually.";
  let caption: string | undefined;
  try {
    const response = await new Anthropic({ timeout: 60000 }).beta.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "Draft one social caption for the specified platform in this brand's voice. " +
        shared.instruction +
        " The media description is the user's own summary of the attached photos or video; describe only what it states. Return only the editable caption, up to 6000 characters.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({ brandContext: shared.data }),
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: JSON.stringify({
                platform,
                ...(guidelines ? { platformGuidelines: guidelines } : {}),
                brief,
                ...(mediaDescription ? { mediaDescription } : {}),
              }),
            },
          ],
        },
      ],
    });
    console.log("Caption usage", platform, response.usage);
    if (response.stop_reason === "end_turn")
      caption = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
  } catch (error) {
    console.error("Caption generation failed", error instanceof Error ? error.name : "Unknown error");
  }
  check(caption && caption.length <= 6000, unavailable, 503);
  return caption;
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    check(
      !origin || new URL(origin).host === req.headers.get("host"),
      "Open the workspace at its own web address and try again.",
      403,
    );
    const contentType = req.headers.get("content-type") || "";
    if (contentType.startsWith("multipart/form-data")) {
      return await upload(requireUser(req), req, contentType);
    }
    check(
      contentType.startsWith("application/json"),
      "Send a JSON request or media upload.",
      415,
    );
    const bytes = await limitedBody(req, 160000);
    let body;
    try {
      body = JSON.parse(bytes.toString());
    } catch {
      throw new Problem("The request could not be read. Try again.");
    }
    check(
      body && typeof body === "object" && !Array.isArray(body),
      "Choose a workspace action.",
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
    return failure(error);
  }
}
