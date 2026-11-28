import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createServer as createHttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { createServer } from "node:net";

nextEnv.loadEnvConfig(process.cwd());
const directUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
assert(
  directUrl,
  "Set the direct Neon connection string before running this check.",
);
const admin = new pg.Client({ connectionString: directUrl });
const testName = "hub_check_" + randomUUID().replaceAll("-", "");
const testUrl = new URL(directUrl);
testUrl.pathname = "/" + testName;
const pool = new pg.Pool({ connectionString: testUrl.href });
let created = false;
const portFinder = createServer();
portFinder.listen(0, "127.0.0.1");
await once(portFinder, "listening");
const port = portFinder.address().port;
await new Promise((resolve) => portFinder.close(resolve));
const url = "http://127.0.0.1:" + port + "/api/workspace";
const objects = new Map();
const objectTypes = new Map();
let rejectKeyAfter;
const storage = createHttpServer(async (req, res) => {
  const key = new URL(req.url, "http://localhost").pathname;
  const fail = (status, code) => {
    res.writeHead(status, { "Content-Type": "application/xml" });
    res.end(`<Error><Code>${code}</Code></Error>`);
  };
  const query = new URL(req.url, "http://localhost").searchParams;
  if (!(req.headers.authorization || query.has("X-Amz-Signature")) || !key.startsWith("/test/projects/"))
    return fail(403, "AccessDenied");
  if (req.method === "PUT") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (objects.size === rejectKeyAfter) return fail(403, "AccessDenied");
    if (objects.has(key) && req.headers["if-none-match"] === "*")
      return fail(412, "PreconditionFailed");
    objects.set(key, Buffer.concat(chunks));
    objectTypes.set(key, req.headers["content-type"]);
  } else if (req.method === "HEAD") {
    res.writeHead(objects.has(key) ? 200 : 404);
  } else if (req.method === "GET") {
    if (!objects.has(key)) return fail(404, "NoSuchKey");
    const type = query.get("response-content-type") || objectTypes.get(key);
    if (type) res.setHeader("Content-Type", type);
    const body = objects.get(key);
    // Attaching an upload reads only its first bytes, as R2 does for a Range request.
    const range = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || "");
    if (range) {
      const end = Math.min(Number(range[2]), body.length - 1);
      res.writeHead(206, { "Content-Range": `bytes ${range[1]}-${end}/${body.length}` });
      return res.end(body.subarray(Number(range[1]), end + 1));
    }
    return res.end(body);
  } else if (req.method === "DELETE") {
    objects.delete(key);
  } else return fail(405, "MethodNotAllowed");
  res.end();
});
storage.listen(0, "127.0.0.1");
await once(storage, "listening");
// A stand-in for graph.facebook.com that records every call.
const graphCalls = [];
let igStatus = "IN_PROGRESS";
let revoked = false;
const graphServer = createHttpServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  let body = "";
  for await (const chunk of req) body += chunk;
  const params = Object.fromEntries(new URLSearchParams(req.method === "POST" ? body : u.search));
  const path = u.pathname.replace(/^\/v[\d.]+/, "");
  graphCalls.push({ method: req.method, path, params });
  const json = (value, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  if (path === "/oauth/access_token")
    return json({ access_token: params.code ? "short-token" : "long-token" });
  if (path === "/me/accounts")
    return json({
      data: [{ id: "page1", name: "Lantern Page", access_token: "page-token", instagram_business_account: { id: "ig1", username: "lantern" } }],
    });
  if (params.access_token !== "page-token" || revoked)
    return json({ error: { message: "Session expired", code: 190 } }, 400);
  if (path === "/page1/photos") return json({ id: "photo1", post_id: "page1_1" });
  if (path === "/ig1/media") return json({ id: "container1" });
  if (path === "/container1") return json({ status_code: igStatus });
  if (path === "/ig1/media_publish") return json({ id: "igmedia" });
  if (path === "/igmedia") return json({ permalink: "https://www.instagram.com/p/test/" });
  json({ error: { message: "Unknown path " + path } }, 404);
});
graphServer.listen(0, "127.0.0.1");
await once(graphServer, "listening");
const testEnv = {
  ...process.env,
  DATABASE_URL: testUrl.href,
  ANTHROPIC_API_KEY: " ",
  R2_ENDPOINT: "http://127.0.0.1:" + storage.address().port,
  R2_BUCKET: "test",
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  AUTH_SECRET: "x".repeat(32),
  META_GRAPH_URL: "http://127.0.0.1:" + graphServer.address().port,
  META_APP_ID: "app",
  META_APP_SECRET: "secret",
  APP_URL: "http://127.0.0.1:" + port,
  TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
  CRON_SECRET: "cron-secret",
};
let child, cookie;
async function start() {
  child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      stdio: "inherit",
      env: testEnv,
      windowsHide: true,
    },
  );
  for (let i = 0; i < 180; i++) {
    if (child.exitCode !== null) throw new Error("Test server exited");
    if (
      await fetch(url).then(
        (r) => r.ok,
        () => false,
      )
    )
      return;
    await delay(250);
  }
  throw new Error("Test server did not start");
}
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, "exit");
    child.kill();
    await stopped;
  }
}
async function request(body, status = 200) {
  const form = body instanceof FormData;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(form ? {} : { "content-type": "application/json" }),
    },
    body: form ? body : JSON.stringify(body),
  });
  if (resp.headers.has("set-cookie"))
    cookie = resp.headers.get("set-cookie").split(";")[0];
  const reply = await resp.json();
  assert.equal(resp.status, status, JSON.stringify(reply));
  return reply;
}
const action = (project, action, fields = {}, status = 200) =>
  request({ project, action, ...fields }, status);
async function post(body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: resp.status, reply: await resp.json() };
}
/**
 * The browser's upload: ask for signed links, PUT each file to storage, then attach.
 * `status` is the first non-200 status expected from either workspace request.
 */
async function upload(project, files, { existing = [], purpose } = {}, status = 200) {
  const extra = { project, existing, ...(purpose ? { purpose } : {}) };
  const signed = await post({
    action: "upload",
    ...extra,
    files: files.map(([name, type, bytes]) => ({ name, type, size: Buffer.byteLength(bytes) })),
  });
  if (signed.status !== 200) {
    assert.equal(signed.status, status, JSON.stringify(signed.reply));
    return signed.reply;
  }
  for (const [i, { url: link }] of signed.reply.uploads.entries()) {
    const put = await fetch(link, { method: "PUT", headers: { "content-type": files[i][1] }, body: files[i][2] });
    if (!put.ok) return { putFailed: true };
  }
  const attached = await post({ action: "attach", ...extra, assets: signed.reply.uploads.map((u) => u.asset) });
  assert.equal(attached.status, status, JSON.stringify(attached.reply));
  return attached.reply;
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQxkAAAAASUVORK5CYII=",
  "base64",
);
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testName}"`);
  created = true;
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await start();
  // Languages: /en and /th. "/" picks the saved choice (NEXT_LOCALE), then the browser's language.
  const site = new URL("/", url);
  const landing = async (headers) => {
    const reply = await fetch(site, { headers, redirect: "manual" });
    assert.equal(reply.status, 307);
    return new URL(reply.headers.get("location"), site).pathname;
  };
  const thaiBrowser = { "accept-language": "th-TH,th;q=0.9,en;q=0.5" };
  assert.equal(await landing(thaiBrowser), "/th");
  assert.equal(await landing({ ...thaiBrowser, cookie: "NEXT_LOCALE=en" }), "/en");
  assert.equal(await landing({}), "/en");
  // Meta's return link keeps its query through the redirect.
  const back = await fetch(new URL("/?project=p1&meta=linked", url), { headers: thaiBrowser, redirect: "manual" });
  assert.equal(back.headers.get("location").replace(/^https?:\/\/[^/]+/, ""), "/th?project=p1&meta=linked");
  const thai = await fetch(new URL("/th", url));
  assert.equal(thai.status, 200);
  const thaiHtml = await thai.text();
  assert.match(thaiHtml, /<html lang="th"/);
  assert.match(thaiHtml, /พื้นที่ทำงาน/);
  const english = await fetch(new URL("/en", url));
  assert.equal(english.status, 200);
  assert.match(await english.text(), /<html lang="en"/);
  assert.equal((await fetch(new URL("/th/nowhere", url))).status, 404);
  // Dedicated sign-in and sign-up pages, with a show-password button.
  const loginHtml = await (await fetch(new URL("/en/login", url))).text();
  assert.match(loginHtml, /type="password"/);
  assert.match(loginHtml, /autoComplete="current-password"|autocomplete="current-password"/);
  assert.match(loginHtml, /aria-label="Show password"/);
  const signupHtml = await (await fetch(new URL("/th/signup", url))).text();
  assert.match(signupHtml, /สร้างบัญชีของคุณ/);
  assert.match(signupHtml, /autocomplete="new-password"/i);
  assert.match(signupHtml, /aria-label="แสดงรหัสผ่าน"/);
  const thaiError = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-locale": "th" },
    body: JSON.stringify({ action: "create" }),
  });
  assert.equal(thaiError.status, 401);
  assert.equal((await thaiError.json()).error, "โปรดเข้าสู่ระบบเพื่อเปิดพื้นที่ทำงาน");
  await request({ action: "create" }, 401);
  const owner = { email: "owner@example.test", password: "correct horse battery" };
  await request({ action: "signup", ...owner });
  await request({ action: "signup", ...owner }, 409);
  await request({ action: "signin", email: owner.email, password: "wrong password" }, 401);
  cookie = "hub-session=" + randomUUID() + ".9999999999999.forged";
  await request({ action: "create" }, 401);
  // A forged session still sees the sign-in form.
  assert.doesNotMatch(await (await fetch(new URL("/en/login", url), { headers: { cookie } })).text(), /NEXT_REDIRECT/);
  await request({ action: "signin", ...owner });
  // Signed in, the sign-in page sends you on to the workspace.
  assert.match(await (await fetch(new URL("/en/login", url), { headers: { cookie } })).text(), /NEXT_REDIRECT;replace;\/en;/);
  const create = (name, tone) =>
    request({
      action: "create",
      name,
      description: name + " studio",
      audience: "Readers",
      tone,
    });
  const a = (await create("Grove", "Quiet")).project;
  const b = (await create("Ferry", "Bright")).project;
  // A second account sees none of the owner's projects.
  await request({ action: "signup", email: "other@example.test", password: "another password" });
  assert.equal((await (await fetch(url, { headers: { cookie } })).json()).projects.length, 0);
  await action(a.id, "voice", { voice: "# Taken" }, 404);
  await action(a.id, "delete", {}, 404);
  await request({ action: "signin", ...owner });
  // Rate limits: 10 sign-ins per email and 5 sign-ups per address.
  const victim = { email: "locked@example.test", password: "guess password" };
  for (let i = 0; i < 10; i++) await request({ action: "signin", ...victim }, 401);
  await request({ action: "signin", ...victim }, 429);
  await request({ action: "signup", email: "fourth@example.test", password: "another password" });
  await request({ action: "signup", email: "fifth@example.test", password: "another password" });
  await request({ action: "signup", email: "sixth@example.test", password: "another password" }, 429);
  await request({ action: "signin", ...owner });
  await action(a.id, "voice", { voice: "# Grove\n\nEdited voice." });
  await Promise.all(
    ["Facebook", "Instagram"].map((platform) =>
      action(a.id, "connect", { platform }),
    ),
  );
  await action(b.id, "connect", { platform: "TikTok" });
  rejectKeyAfter = 1;
  assert(
    (
      await upload(a.id, [
        ["ok.png", "image/png", png],
        ["fail.png", "image/png", png],
      ])
    ).putFailed,
  );
  // The browser never attaches a half-finished upload; its stored half is an orphan.
  objects.clear();
  assert.deepEqual(
    (await pool.query("SELECT assets FROM projects WHERE id = $1", [a.id]))
      .rows[0].assets,
    [],
  );
  rejectKeyAfter = undefined;
  const { assets } = await upload(a.id, [
    ["first.png", "image/png", png],
    ["second.png", "image/png", png],
  ]);
  await upload(a.id, [["wrong.png", "image/png", "not a photo"]], {}, 400);
  for (const key of objects.keys()) if (!key.endsWith(assets[0].id) && !key.endsWith(assets[1].id)) objects.delete(key);
  await upload(a.id, Array.from({ length: 11 }, () => ["many.png", "image/png", png]), {}, 400);
  await upload(a.id, [["big.png", "image/png", Buffer.alloc(8 * 1024 * 1024 + 1)]], {}, 400);
  const video = [
    "clip.webm",
    "video/webm",
    Buffer.concat([Buffer.from("1a45dfa3", "hex"), Buffer.from("webm")]),
  ];
  await upload(a.id, [video], { existing: [assets[0].id] }, 400);
  for (const key of objects.keys()) if (!key.endsWith(assets[0].id) && !key.endsWith(assets[1].id)) objects.delete(key);
  const clip = (await upload(b.id, [video])).assets[0];
  assert.equal(objects.size, 3);
  assert.equal((await pool.query("SELECT id FROM media")).rowCount, 0);
  const key = `/test/projects/${a.id}/media/${assets[0].id}`;
  assert.deepEqual(objects.get(key), png);
  // Reconstruct one pre-R2 attachment with its original ID and URL.
  objects.delete(key);
  await pool.query(
    "INSERT INTO media (id, project_id, data) VALUES ($1, $2, $3)",
    [assets[0].id, a.id, png],
  );
  const legacy = await fetch(
    url + "?project=" + a.id + "&asset=" + assets[0].id,
    { headers: { cookie } },
  );
  assert.deepEqual(Buffer.from(await legacy.arrayBuffer()), png);
  for (let i = 0; i < 2; i++) {
    await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "scripts/migrate-media.ts"],
      { env: testEnv, windowsHide: true },
    );
    assert.deepEqual(objects.get(key), png);
  }
  const clipResp = await fetch(url + "?project=" + b.id + "&asset=" + clip.id, {
    headers: { cookie },
  });
  assert.equal(clipResp.headers.get("content-type"), "video/webm");
  const brief = "Studio opening";
  const media = [assets[1].id, assets[0].id];
  const captions = {
    Facebook: "See you there.",
    Instagram: "Doors open soon.",
  };
  const future = new Date(Date.now() + 3600000).toISOString();
  const fields = {
    draftId: randomUUID(),
    brief,
    media,
    captions,
    when: future,
  };
  await action(
    b.id,
    "schedule",
    { ...fields, captions: { TikTok: "Hello" } },
    400,
  );
  await action(
    a.id,
    "schedule",
    { ...fields, when: "2020-01-01T00:00:00.000Z" },
    400,
  );
  assert.match(
    (await action(a.id, "generate", { platform: "Facebook", brief }, 503))
      .error,
    /caption/i,
  );
  assert.match(
    (await action(a.id, "generate", { platform: "Facebook", brief, media }, 400))
      .error,
    /description/i,
  );
  await Promise.all([
    action(a.id, "schedule", fields),
    action(a.id, "schedule", fields),
  ]);
  const canceled = randomUUID();
  await action(a.id, "schedule", { ...fields, draftId: canceled });
  await action(a.id, "cancel", { postId: canceled });
  const due = new Date(Date.now() + 2000).toISOString();
  await action(a.id, "reschedule", { postId: fields.draftId, when: due });
  // Library batches skip the one-post media rules: two videos and a photo together.
  const batch = await upload(a.id, [video, video, ["third.png", "image/png", png]], { purpose: "library" });
  assert.equal(batch.assets.length, 3);
  await upload(a.id, [video, video], {}, 400);
  // Editorial notes are stored with the brand voice and can point at a post and channel.
  const note = (fields, status) => action(a.id, "note", fields, status);
  await note({ text: "No ID" }, 400);
  const general = { noteId: randomUUID(), text: "Fewer emoji." };
  await note(general);
  assert.equal((await note(general)).project.editorial.length, 1);
  await note({ noteId: randomUUID(), text: "x".repeat(501) }, 400);
  await note({ noteId: randomUUID(), text: "Lost", postId: randomUUID() }, 404);
  await note({ noteId: randomUUID(), text: "Wrong channel", postId: fields.draftId, platform: "TikTok" }, 400);
  const about = (await note({ noteId: randomUUID(), text: "Great hook.", postId: fields.draftId, platform: "Instagram" })).project
    .editorial[1];
  assert.deepEqual([about.postId, about.platform, about.caption], [fields.draftId, "Instagram", captions.Instagram]);
  const noted = { ...fields, draftId: randomUUID(), note: "Lead with the date." };
  await action(a.id, "schedule", noted);
  const afterRetry = (await action(a.id, "schedule", noted)).project.editorial;
  assert.deepEqual(afterRetry.map((n) => n.text), ["Fewer emoji.", "Great hook.", "Lead with the date."]);
  assert.equal(afterRetry[2].postId, noted.draftId);
  await action(a.id, "cancel", { postId: noted.draftId });
  const removable = randomUUID();
  await note({ noteId: removable, text: "Temporary" });
  assert.equal((await action(a.id, "unnote", { noteId: removable })).project.editorial.length, 3);
  for (let i = 3; i < 40; i++) await note({ noteId: randomUUID(), text: "Note " + i });
  assert.match((await note({ noteId: randomUUID(), text: "One too many" }, 400)).error, /40/);
  await stop();
  await delay(Math.max(0, Date.parse(due) - Date.now() + 50));
  await start();
  const state = await (await fetch(url, { headers: { cookie } })).json();
  assert.equal(state.projects.length, 2);
  const page = await fetch(new URL("/en", url), { headers: { cookie } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Grove/);
  const first = state.projects.find((p) => p.id === a.id);
  const second = state.projects.find((p) => p.id === b.id);
  assert.equal(first.voice, "# Grove\n\nEdited voice.");
  assert.match(second.voice, /Bright/);
  assert.deepEqual(first.channels.sort(), ["Facebook", "Instagram"]);
  assert.deepEqual(second.channels, ["TikTok"]);
  assert.equal(first.posts.length, 3);
  assert.equal(first.editorial.length, 40);
  assert.equal(first.editorial[1].caption, captions.Instagram);
  assert.equal(second.posts.length, 0);
  assert.deepEqual(
    second.assets.map((a) => a.id),
    [clip.id],
  );
  const post = first.posts.find((p) => p.id === fields.draftId);
  assert.deepEqual(post.media, media);
  assert.equal(post.when, due);
  assert.deepEqual(
    post.destinations,
    Object.entries(captions).map(([platform, caption]) => ({
      platform,
      caption,
      status: "Delivered",
    })),
  );
  assert(
    first.posts
      .find((p) => p.id === canceled)
      .destinations.every((d) => d.status === "Canceled"),
  );
  const {
    rows: [persisted],
  } = await pool.query("SELECT posts FROM projects WHERE id = $1", [a.id]);
  assert(
    persisted.posts
      .find((p) => p.id === fields.draftId)
      .destinations.every((d) => d.status === "Delivered"),
  );
  const raw = await fetch(url + "?project=" + a.id + "&asset=" + media[0], {
    headers: { cookie },
  });
  assert.deepEqual(Buffer.from(await raw.arrayBuffer()), png);
  assert.equal(
    (
      await fetch(url + "?project=" + b.id + "&asset=" + media[0], {
        headers: { cookie },
      })
    ).status,
    404,
  );
  await action(a.id, "cancel", { postId: fields.draftId }, 409);
  const brand = (fields, status) => action(a.id, "brand", fields, status);
  const draft = { status: "draft", step: 4, revision: 0, profile: { brand_identity: { name: " Grove " } } };
  const savedDraft = (await brand(draft)).project;
  assert.equal(savedDraft.brand.step, 4);
  assert.equal(savedDraft.voice, first.voice);
  assert.equal(savedDraft.brand.draft.brand_identity.name, "Grove");
  await brand(draft, 409);
  const submit = { ...draft, status: "completed", revision: 1, step: 8 };
  await brand({ ...submit, profile: {} }, 400);
  await brand({ ...submit, profile: { ...draft.profile, visual_identity: { assets: [clip.id] } } }, 400);
  const guideId = (await upload(a.id, [["Guide.pdf", "application/pdf", "%PDF-1.7\n"]], { purpose: "brand" })).assets[0].id;
  await brand({ ...submit, profile: { ...draft.profile, visual_identity: { logo: guideId } } }, 400);
  const profile = { ...draft.profile, visual_identity: { logo: assets[0].id, assets: [guideId] }, approval_rules: { rules: "Confirm before naming customers." } };
  const completed = (await brand({ ...submit, profile })).project;
  assert.equal(completed.brand.draft, undefined);
  assert.match(completed.voice, /Guide.pdf/);
  assert.match(completed.voice, /Confirm before naming customers/);
  await brand({ ...draft, revision: 2, profile: { ...profile, brand_identity: { name: "Edited name" } } });
  const resumed = (await (await fetch(url, { headers: { cookie } })).json()).projects.find(p => p.id === a.id);
  assert.equal(resumed.brand.draft.brand_identity.name, "Edited name");
  assert.equal(resumed.brand.completed.brand_identity.name, "Grove");
  assert.equal(resumed.voice, completed.voice);
  const keysBefore = objects.size;
  await action(b.id, "delete");
  await action(b.id, "delete", {}, 404);
  assert.equal(objects.size, keysBefore - 1);
  assert.equal((await (await fetch(url, { headers: { cookie } })).json()).projects.length, 1);
  // Automatic publishing through a linked Facebook Page and Instagram account.
  const c = (await create("Lantern", "Warm")).project;
  const cron = (auth = "Bearer cron-secret") =>
    fetch(new URL("/api/cron/publish", url), { headers: { authorization: auth } });
  assert.equal((await cron("Bearer wrong")).status, 401);
  const begin = await fetch(new URL("/api/meta?project=" + c.id, url), { headers: { cookie }, redirect: "manual" });
  const dialog = new URL(begin.headers.get("location"));
  assert.equal(dialog.hostname, "www.facebook.com");
  const stateCookie = begin.headers.get("set-cookie").split(";")[0];
  const callback = new URL("/api/meta?code=abc&state=" + encodeURIComponent(dialog.searchParams.get("state")), url);
  // Without the browser's state cookie the callback links nothing.
  assert.match(await (await fetch(callback, { redirect: "manual" })).text(), /meta=expired/);
  assert.equal((await pool.query("SELECT 1 FROM connections")).rowCount, 0);
  // The callback answers with a same-site page hop, not a redirect, so the Strict session cookie survives.
  const linkedReply = await fetch(callback, { headers: { cookie: stateCookie }, redirect: "manual" });
  assert.equal(linkedReply.status, 200);
  assert.match(await linkedReply.text(), /url=\/\?project=[\w-]+&meta=linked/);
  const { rows: tokens } = await pool.query("SELECT platform, token FROM connections WHERE project_id = $1", [c.id]);
  assert.equal(tokens.length, 2);
  assert(tokens.every((t) => !t.token.includes("page-token")));
  const listed = await (await fetch(url, { headers: { cookie } })).text();
  assert(!listed.includes("page-token") && !listed.includes(tokens[0].token));
  const lantern = JSON.parse(listed).projects.find((p) => p.id === c.id);
  assert.deepEqual(lantern.linked, { Facebook: "Lantern Page", Instagram: "@lantern" });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const [photo] = (await upload(c.id, [["shot.jpg", "image/jpeg", jpeg]])).assets;
  const [flat] = (await upload(c.id, [["flat.png", "image/png", png]])).assets;
  const newPost = (fields) => ({ draftId: randomUUID(), brief: "Lanterns", when: new Date(Date.now() + 1500).toISOString(), ...fields });
  assert.match(
    (await action(c.id, "schedule", newPost({ media: [flat.id], captions: { Instagram: "Glow" } }), 400)).error,
    /JPEG/,
  );
  const auto = newPost({ media: [photo.id], captions: { Facebook: "Lit", Instagram: "Glow" } });
  await action(c.id, "schedule", auto);
  await delay(Math.max(0, Date.parse(auto.when) - Date.now() + 50));
  const lanternPost = async (id = auto.draftId) =>
    (await (await fetch(url, { headers: { cookie } })).json()).projects.find((p) => p.id === c.id).posts.find((p) => p.id === id);
  // Reading the schedule does not mark linked destinations as delivered.
  assert((await lanternPost()).destinations.every((d) => d.status === "Scheduled" && d.auto));
  await Promise.all([cron(), cron()]);
  assert.equal(graphCalls.filter((g) => g.path === "/page1/photos").length, 1);
  assert.equal(graphCalls.filter((g) => g.path === "/ig1/media").length, 1);
  const shared = graphCalls.find((g) => g.path === "/page1/photos").params.url;
  assert.deepEqual(Buffer.from(await (await fetch(shared)).arrayBuffer()), jpeg);
  assert.equal((await fetch(shared.replace(/.$/, (ch) => (ch === "A" ? "B" : "A")))).status, 404);
  let [fb, ig] = (await lanternPost()).destinations;
  assert.deepEqual([fb.status, fb.url], ["Published", "https://www.facebook.com/page1_1"]);
  assert.deepEqual([ig.status, ig.container], ["Publishing", "container1"]);
  await cron();
  assert.equal((await lanternPost()).destinations[1].status, "Publishing");
  igStatus = "FINISHED";
  await Promise.all([cron(), cron()]);
  ig = (await lanternPost()).destinations[1];
  assert.deepEqual([ig.status, ig.url], ["Published", "https://www.instagram.com/p/test/"]);
  assert.equal(graphCalls.filter((g) => g.path === "/ig1/media_publish").length, 1);
  revoked = true;
  const expired = newPost({ media: [], captions: { Facebook: "Again" } });
  await action(c.id, "schedule", expired);
  await delay(Math.max(0, Date.parse(expired.when) - Date.now() + 50));
  await cron();
  const failedDest = (await lanternPost(expired.draftId)).destinations[0];
  assert.equal(failedDest.status, "Failed");
  assert.match(failedDest.error, /Reconnect Facebook/);
  await action(c.id, "disconnect", { platform: "Facebook" });
  assert.equal((await pool.query("SELECT 1 FROM connections WHERE project_id = $1", [c.id])).rowCount, 1);
  console.log(
    "Scheduler, brand profile and publishing checks passed.",
  );
} finally {
  await stop();
  await new Promise((resolve) => storage.close(resolve));
  await new Promise((resolve) => graphServer.close(resolve));
  await pool.end();
  try {
    if (created) await admin.query(`DROP DATABASE "${testName}"`);
  } finally {
    await admin.end();
  }
}
