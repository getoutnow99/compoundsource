"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form className="login" action={action}>
      <h1 style={{ fontSize: 24 }}>Clinic sign in</h1>
      <label htmlFor="email">
        Email
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} />
      </label>
      <label htmlFor="password">
        Password
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && <p className="err">{state.error}</p>}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="hint">
        New clinic? <Link href="/signup">Sign up for an account</Link>
      </p>
    </form>
  );
}
