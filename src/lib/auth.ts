import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { one, query } from "./db";

const COOKIE = "cs_session";
// Sign out after 60 idle minutes and always after 12 hours.
const IDLE_MS = 60 * 60 * 1000;
const MAX_MS = 12 * 60 * 60 * 1000;

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "clinic" | "admin";
  clinic_id: number | null;
  clinic_name: string | null;
  clinic_status: string | null;
};

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + $3 * interval '1 millisecond')", [
    hashToken(token),
    userId,
    MAX_MS,
  ]);
  await query("update users set last_login_at = now() where id = $1", [userId]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  jar.delete(COOKIE);
}

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const h = hashToken(token);
  const user = await one<SessionUser>(
    `select u.id, u.email, u.name, u.role, u.clinic_id, c.name as clinic_name, c.status as clinic_status
       from sessions s join users u on u.id = s.user_id left join clinics c on c.id = u.clinic_id
      where s.token_hash = $1 and s.expires_at > now() and s.last_seen > now() - $2 * interval '1 millisecond'`,
    [h, IDLE_MS],
  );
  if (!user) return null;
  await query("update sessions set last_seen = now() where token_hash = $1", [h]);
  return user;
}

export async function requireClinic() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");
  if (user.clinic_status !== "approved") redirect("/pending");
  return user as SessionUser & { clinic_id: number };
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/orders");
  return user;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
}
