"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { one } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type LoginState = { error?: string; email?: string };

// Equalizes timing when the email doesn't exist.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.7b5bW4Yp6S6V7l5b1Vb8m3l7Yq0e";

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const user = await one<{ id: number; password_hash: string; role: string }>(
    "select id, password_hash, role from users where email = $1",
    [email],
  );
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    await audit(user?.id ?? null, "login_failed", "user", email);
    return { error: "That email and password don't match. Check them and try again.", email };
  }
  await createSession(user.id);
  await audit(user.id, "login", "user", user.id);
  redirect(user.role === "admin" ? "/admin" : "/orders");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
