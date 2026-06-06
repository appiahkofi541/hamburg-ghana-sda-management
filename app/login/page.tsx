"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, LockKeyhole, Mail } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectPath } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (reason === "supabase-not-configured") {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel or .env.local.");
    } else if (reason === "supabase-unavailable") {
      setError("Supabase could not be reached. Check the project URL, public key, and network connection.");
    } else if (reason === "auth-callback") {
      setError("The authentication link could not be completed. Request a new link and try again.");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel or .env.local.");
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      const next = getSafeRedirectPath(new URLSearchParams(window.location.search).get("next"));
      router.push(next);
    } catch {
      setError("Supabase could not be reached. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-navy-deep px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-24 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-10 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -bottom-36 -left-20 h-96 w-96 rounded-full bg-churchblue/20" />
        <div className="relative flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="text-lg font-bold">Hamburg Ghana SDA Church</p>
            <p className="text-sm text-blue-200">Hamburg, Germany</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-gold">Church Administration Portal</p>
          <h1 className="text-5xl font-bold leading-[1.12]">Serving our church family with clarity and care.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-blue-100">
            Manage membership, ministry, attendance, giving, and church life from one secure place.
          </p>
        </div>
        <p className="relative text-xs text-blue-200">© 2026 Hamburg Ghana SDA Church. All rights reserved.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <LogoMark small />
            <div>
              <p className="font-bold text-navy">Hamburg Ghana SDA Church</p>
              <p className="text-xs text-slate-500">Hamburg, Germany</p>
            </div>
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-churchblue">Welcome Back</p>
          <h2 className="mt-3 text-3xl font-bold text-navy">Sign in to your account</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Access the Hamburg Ghana SDA Church Management System.</p>
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-slate-700">
              Email address
              <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-4 focus-within:border-churchblue">
                <Mail className="h-4 w-4 text-slate-400" />
                <input className="w-full border-0 bg-transparent text-sm font-normal outline-none placeholder:text-slate-400" type="email" placeholder="name@hamburgghanasda.de" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-4 focus-within:border-churchblue">
                <LockKeyhole className="h-4 w-4 text-slate-400" />
                <input className="w-full border-0 bg-transparent text-sm font-normal outline-none placeholder:text-slate-400" type="password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <Eye className="h-4 w-4 text-slate-400" />
              </span>
            </label>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-500"><input type="checkbox" className="accent-churchblue" /> Remember me</label>
              <a className="font-semibold text-churchblue" href="/forgot-password">Forgot password?</a>
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center rounded-lg bg-churchblue text-sm font-bold text-white transition-colors hover:bg-navy disabled:opacity-60">
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">Need help accessing your account?<br />Contact your church administrator.</p>
        </div>
      </section>
    </main>
  );
}
