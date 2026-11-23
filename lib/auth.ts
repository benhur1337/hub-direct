import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, isNull, sql } from "drizzle-orm";
import { database } from "./db";
import { projects, users } from "./schema";
import { check, Problem } from "./store";

export const sessionCookie = "hub-session";
export const sessionAge = 30 * 24 * 60 * 60;
const hash = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export function sign(payload: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Set AUTH_SECRET (32+ characters) in .env.local.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function tokenKey() {
  const key = Buffer.from(process.env.TOKEN_KEY ?? "", "base64");
  if (key.length !== 32)
    throw new Problem("Set TOKEN_KEY (32 random bytes, base64) in .env.local and restart.", 503);
  return key;
}
/** Encrypts a platform access token for storage. */
export function seal(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}
export function unseal(sealed: string) {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
export const same = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );

function credentials(body: Record<string, unknown>) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  check(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Enter a valid email address.");
  const password = body.password;
  check(
    typeof password === "string" && password.length >= 8 && password.length <= 128,
    "Use a password of 8 to 128 characters.",
  );
  return { email, password };
}
async function passwordHash(password: string, salt = randomBytes(16)) {
  return salt.toString("hex") + ":" + (await hash(password, salt, 64)).toString("hex");
}
const decoy = passwordHash("decoy password");

// shortcut: per-process memory, so limits reset on restart and aren't shared across instances; move to Neon or Redis before running more than one server.
const attempts = new Map<string, number[]>();
export function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (attempts.size > 10000)
    for (const [k, times] of attempts) if (now - times[times.length - 1] > 3600000) attempts.delete(k);
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  check(recent.length < max, "Too many attempts. Wait 15 minutes and try again.", 429);
  recent.push(now);
  attempts.set(key, recent);
}
const minutes = (n: number) => n * 60000;

export async function signUp(body: Record<string, unknown>, ip: string) {
  limit("signup:" + ip, 5, minutes(60));
  const { email, password } = credentials(body);
  const id = randomUUID();
  const stored = await passwordHash(password);
  return database().transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ id, email, passwordHash: stored })
      .onConflictDoNothing()
      .returning({ id: users.id });
    check(user, "An account with this email already exists. Sign in instead.", 409);
    // The first account inherits projects created before sign-up existed.
    await tx
      .update(projects)
      .set({ userId: id })
      .where(and(isNull(projects.userId), sql`(select count(*) from ${users}) = 1`));
    return id;
  });
}
// The email key stops guessing one account even when the IP is spoofed or rotated.
export async function signIn(body: Record<string, unknown>, ip: string) {
  limit("signin-ip:" + ip, 30, minutes(15));
  const { email, password } = credentials(body);
  limit("signin:" + email, 10, minutes(15));
  const [user] = await database().select().from(users).where(eq(users.email, email));
  const [salt, expected] = (user?.passwordHash ?? (await decoy)).split(":");
  const actual = (await hash(password, Buffer.from(salt, "hex"), 64)).toString("hex");
  if (!user || !same(actual, expected))
    throw new Problem("Email or password is incorrect.", 401);
  return user.id;
}

// shortcut: stateless tokens; sign-out clears this browser only, rotate AUTH_SECRET to end every session.
export function newSession(userId: string) {
  const payload = userId + "." + (Date.now() + sessionAge * 1000);
  return payload + "." + sign(payload);
}
/** Returns the signed-in user's id, or undefined. */
export function sessionUser(token: string | undefined) {
  const [userId, expires, signature] = token?.split(".") ?? [];
  if (!signature || !(Number(expires) > Date.now())) return;
  try {
    if (same(signature, sign(userId + "." + expires))) return userId;
  } catch {}
}
