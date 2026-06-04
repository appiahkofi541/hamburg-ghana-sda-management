import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-card">
        <div className="flex justify-center"><LogoMark /></div>
        <ShieldAlert className="mx-auto mt-6 h-10 w-10 text-amber-600" />
        <h1 className="mt-4 text-2xl font-bold text-navy">Access restricted</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your church account does not have permission to view this page.</p>
        <Link className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-churchblue px-4 text-sm font-bold text-white hover:bg-navy" href="/login">Return to Login</Link>
      </section>
    </main>
  );
}
