"use client";

import { useState } from "react";
import Link from "next/link";
import { sendMagicLink, signIn, signUp } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const session = mode === "sign-in"
        ? await signIn(email, password)
        : await signUp(email, password);
      if (!session.access_token) {
        setNotice("Check your email to confirm your account, then sign in.");
        return;
      }
      window.location.assign("/");
    } catch (submitError) {
      setError(submitError.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const sendLink = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await sendMagicLink(email);
      setNotice("If the address is eligible, a sign-in link has been sent.");
    } catch (linkError) {
      setError(linkError.message || "Could not send a sign-in link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-16 text-white">
      <section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#111318] p-8 shadow-2xl">
        <Link href="/" className="text-sm text-white/55 hover:text-white">← Back to Studio</Link>
        <h1 className="mt-8 text-2xl font-semibold">Gallery account</h1>
        <p className="mt-2 text-sm text-white/55">Sign in to save and browse your generation history and projects.</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm text-white/70">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-white/30"
            />
          </label>
          <label className="block text-sm text-white/70">
            Password
            <input
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-white/30"
            />
          </label>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-white px-4 py-2.5 font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
            setError("");
            setNotice("");
          }}
          className="mt-5 text-sm text-white/60 hover:text-white"
        >
          {mode === "sign-in" ? "Create a new account" : "Already have an account? Sign in"}
        </button>
        <button type="button" disabled={busy || !email} onClick={() => void sendLink()} className="mt-4 block text-sm text-white/60 underline hover:text-white disabled:opacity-40">
          Send a sign-in link instead
        </button>
      </section>
    </main>
  );
}
