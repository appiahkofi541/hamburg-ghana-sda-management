"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Add the project URL and anonymous key to .env.local.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push("/dashboard?password=updated");
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
        <h1 className="mt-2 text-2xl font-bold text-navy">Change password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Choose a new secure password for your church management account.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {[
            ["New password", password, setPassword],
            ["Confirm new password", confirmation, setConfirmation],
          ].map(([label, value, setter]) => (
            <label className="block text-sm font-semibold text-slate-700" key={String(label)}>
              {String(label)}
              <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-4 focus-within:border-churchblue">
                <LockKeyhole className="h-4 w-4 text-slate-400" />
                <input className="w-full bg-transparent text-sm font-normal outline-none" type="password" value={String(value)} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)} required />
              </span>
            </label>
          ))}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button className="h-12 w-full rounded-lg bg-churchblue text-sm font-bold text-white hover:bg-navy disabled:opacity-60" disabled={loading} type="submit">
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>
    </main>
  );
}
