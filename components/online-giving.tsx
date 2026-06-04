"use client";

import { useEffect, useState } from "react";
import { BadgeEuro, Building2, Church, Gift, HandCoins, HeartHandshake, Landmark, Leaf, Plus, Send, ShieldCheck, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type Fund = { id: string; name: string; description: string };
type Giving = { id: string; fund: string; amount: number; status: string; receipt: string; createdAt: string };
const names = ["Tithe", "Offerings", "Building Fund", "Mission Fund", "Thanksgiving Offering", "Health & Disaster", "Evangelism", "Harvest", "Dorcas", "Systematic"];
const icons: Record<string, LucideIcon> = { Tithe: Landmark, Offerings: HandCoins, "Building Fund": Building2, "Mission Fund": Send, "Thanksgiving Offering": Church, "Health & Disaster": HeartHandshake, Evangelism: ShieldCheck, Harvest: Leaf, Dorcas: Gift, Systematic: BadgeEuro };
const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const fundName = (value: { name?: string } | { name?: string }[] | null) => Array.isArray(value) ? value[0]?.name : value?.name;

export function OnlineGiving() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [payments, setPayments] = useState<Giving[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fundId: "", amount: "", donorName: "", donorEmail: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const supabase = createClient(); if (!supabase) return;
    const [{ data: fundRows }, { data: paymentRows }, { data: { user } }] = await Promise.all([
      supabase.from("funds").select("id, name, description").in("name", names).eq("is_active", true),
      supabase.from("online_giving_payments").select("id, amount, status, receipt_number, created_at, funds(name)").order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    const ordered = names.map((name) => (fundRows ?? []).find((fund) => fund.name === name)).filter(Boolean) as Fund[];
    setFunds(ordered);
    setPayments((paymentRows ?? []).map((row) => ({ id: row.id, fund: fundName(row.funds) ?? "Giving", amount: Number(row.amount), status: row.status, receipt: row.receipt_number, createdAt: row.created_at.slice(0, 10) })));
    setForm((current) => ({ ...current, fundId: current.fundId || ordered[0]?.id || "", donorEmail: current.donorEmail || user?.email || "" }));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const response = await fetch("/api/giving/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    const result = await response.json();
    if (result.checkoutUrl) window.location.href = result.checkoutUrl;
    else {
      setError(result.error || "Unable to start online giving.");
      if (result.paymentId) setNotice(`Pending receipt ${result.receiptNumber} was created. Payment has not been completed.`);
      setSaving(false); setShowForm(false); await load();
    }
  }

  return <div className="space-y-6">
    <PageHeading title="Online Giving" description="Support Hamburg Ghana SDA Church through secure online giving." />
    {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
    {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <Card className="flex flex-col justify-between gap-4 bg-gradient-to-r from-navy-deep to-churchblue p-6 text-white sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Faithful Stewardship</p><h2 className="mt-2 text-xl font-bold">Give securely online</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Choose a ministry fund, complete payment through Stripe Checkout, and receive an automatic church receipt.</p></div><Button variant="gold" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Give Online</Button></Card>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{funds.map((fund) => { const Icon = icons[fund.name] ?? Gift; return <Card className="p-4" key={fund.id}><div className="inline-flex rounded-lg bg-blue-50 p-2 text-churchblue"><Icon className="h-4 w-4" /></div><h3 className="mt-3 text-sm font-bold text-navy">{fund.name}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{fund.description}</p></Card>; })}</section>
    <Card><div className="border-b border-slate-100 p-4"><h2 className="font-bold text-navy">My Giving Receipts</h2><p className="mt-1 text-xs text-slate-400">Receipts are generated automatically when you start an online gift.</p></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">Loading giving history...</p> : payments.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No online giving receipts yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{["Date", "Fund", "Receipt", "Status", "Amount", ""].map((item) => <th className="px-5 py-3 font-semibold" key={item}>{item}</th>)}</tr></thead><tbody>{payments.map((payment) => <tr className="border-t border-slate-100" key={payment.id}><td className="px-5 py-4">{payment.createdAt}</td><td className="px-5 py-4 font-semibold text-navy">{payment.fund}</td><td className="px-5 py-4 text-slate-500">{payment.receipt}</td><td className="px-5 py-4"><StatusBadge tone={payment.status === "completed" ? "green" : "gold"}>{payment.status}</StatusBadge></td><td className="px-5 py-4 font-bold text-navy">{currency.format(payment.amount)}</td><td className="px-5 py-4"><Link className="font-bold text-churchblue" href={`/giving/receipt/${payment.id}`}>View receipt</Link></td></tr>)}</tbody></table></div>}</Card>
    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="w-full max-w-xl rounded-xl bg-white shadow-2xl" onSubmit={checkout}><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-bold text-navy">Give Online</h2><Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Fund<select className={fieldClass} required value={form.fundId} onChange={(event) => setForm({ ...form, fundId: event.target.value })}>{funds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Amount (€)<input className={fieldClass} min="1" required step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Name<input className={fieldClass} required value={form.donorName} onChange={(event) => setForm({ ...form, donorName: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Email<input className={fieldClass} required type="email" value={form.donorEmail} onChange={(event) => setForm({ ...form, donorEmail: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button disabled={saving} type="submit"><ShieldCheck className="h-4 w-4" /> {saving ? "Starting..." : "Continue to Secure Payment"}</Button></div></form></div>}
  </div>;
}
