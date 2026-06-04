"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Add the project URL and anonymous key to .env.local.");
      setLoading(false);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=/change-password`;
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setMessage("Check your email for a secure password reset link.");
    } catch {
      setError("Supabase could not be reached. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-card sm:p-8">
        <LogoMark />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-gold">Hamburg Ghana SDA Church</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">Forgot your password?</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Enter your account email and we will send you a secure reset link.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700">
            Email address
            <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-4 focus-within:border-churchblue">
              <Mail className="h-4 w-4 text-slate-400" />
              <input className="w-full bg-transparent text-sm font-normal outline-none" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </span>
          </label>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          <button className="h-12 w-full rounded-lg bg-churchblue text-sm font-bold text-white hover:bg-navy disabled:opacity-60" disabled={loading} type="submit">
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <Link className="mt-6 flex items-center gap-2 text-sm font-semibold text-churchblue" href="/login"><ArrowLeft className="h-4 w-4" /> Back to login</Link>
      </section>
    </main>
  );
}
