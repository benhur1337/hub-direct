import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { projectById, linkAccounts } from "@/lib/store";
import { same, sessionCookie, sessionUser, sign } from "@/lib/auth";
import { graph } from "@/lib/publish";

const stateCookie = "meta-oauth";
const scopes = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

function settings() {
  const { META_APP_ID, META_APP_SECRET, APP_URL } = process.env;
  if (!META_APP_ID || !META_APP_SECRET || !APP_URL) return;
  return { id: META_APP_ID, secret: META_APP_SECRET, redirect: new URL("/api/meta", APP_URL).href };
}
// The workspace turns these codes into messages, so the URL can't inject arbitrary text.
function back(project: string, result: "linked" | "denied" | "pages" | "failed" | "setup" | "expired") {
  const target = `/?project=${encodeURIComponent(project)}&meta=${result}`;
  // An HTML hop instead of a redirect: a redirect chain that started on facebook.com counts as
  // cross-site, so the browser would drop the SameSite=Strict session cookie and show the landing page.
  const reply = new NextResponse(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${target}"><a href="${target}">Continue to Hub Direct</a>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
  reply.cookies.delete({ name: stateCookie, path: "/api/meta" });
  return reply;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const app = settings();
  if (!params.has("state")) {
    // Start: the strict session cookie is present on this same-site navigation.
    const user = sessionUser(req.cookies.get(sessionCookie)?.value);
    const project = params.get("project") || "";
    if (!user) return NextResponse.redirect(new URL("/", req.url));
    try {
      await projectById(user, project);
    } catch {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (!app) return back(project, "setup");
    const nonce = randomBytes(16).toString("base64url");
    const payload = [project, user, Date.now() + 600000, nonce].join(".");
    const dialog = new URL("https://www.facebook.com/v24.0/dialog/oauth");
    dialog.search = new URLSearchParams({
      client_id: app.id,
      redirect_uri: app.redirect,
      state: payload + "." + sign("meta:" + payload),
      scope: scopes,
      response_type: "code",
    }).toString();
    const reply = NextResponse.redirect(dialog);
    // Lax, because the strict session cookie is not sent when Facebook redirects back.
    reply.cookies.set(stateCookie, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/api/meta",
      maxAge: 600,
    });
    return reply;
  }
  // Callback: the signed state names the user and project; the cookie ties it to this browser.
  const [project, user, expires, nonce, signature] = (params.get("state") || "").split(".");
  const payload = [project, user, expires, nonce].join(".");
  const cookie = req.cookies.get(stateCookie)?.value;
  if (
    !signature ||
    !same(sign("meta:" + payload), signature) ||
    !(Number(expires) > Date.now()) ||
    !cookie ||
    !same(cookie, nonce)
  )
    return back(project ?? "", "expired");
  if (!app) return back(project, "setup");
  const code = params.get("code");
  if (!code) return back(project, "denied");
  try {
    const auth = { client_id: app.id, client_secret: app.secret };
    const short = await graph("/oauth/access_token", { ...auth, redirect_uri: app.redirect, code }, "GET");
    // Page tokens taken from a long-lived user token don't expire.
    const long = await graph(
      "/oauth/access_token",
      { ...auth, grant_type: "fb_exchange_token", fb_exchange_token: short.access_token },
      "GET",
    );
    const { data } = await graph(
      "/me/accounts",
      { access_token: long.access_token, fields: "id,name,access_token,instagram_business_account{id,username}" },
      "GET",
    );
    // shortcut: one Page per project; add a Page picker when a brand needs several Pages.
    if (!Array.isArray(data) || data.length !== 1) return back(project, "pages");
    const [page] = data;
    await linkAccounts(user, project, [
      { platform: "Facebook", accountId: page.id, name: page.name, token: page.access_token },
      ...(page.instagram_business_account
        ? [
            {
              platform: "Instagram" as const,
              accountId: page.instagram_business_account.id,
              name: "@" + page.instagram_business_account.username,
              token: page.access_token,
            },
          ]
        : []),
    ]);
    return back(project, "linked");
  } catch (error) {
    console.error("Meta login failed", error instanceof Error ? error.message : "Unknown error");
    return back(project, "failed");
  }
}
