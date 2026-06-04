"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function GivingReceipt({ id }: { id: string }) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>();
  useEffect(() => { async function load() { const supabase = createClient(); if (!supabase) return; const { data } = await supabase.from("online_giving_payments").select("*, funds(name)").eq("id", id).maybeSingle(); setPayment(data); } load(); }, [id]);
  if (payment === undefined) return <p className="p-8 text-center text-sm text-slate-500">Loading receipt...</p>;
  if (!payment) return <Card className="p-8 text-center"><p className="text-sm text-slate-500">Receipt not found.</p><Link className="mt-4 inline-block font-bold text-churchblue" href="/giving">Return to Online Giving</Link></Card>;
  const relatedFund = payment.funds as { name?: string } | { name?: string }[] | undefined;
  const fund = (Array.isArray(relatedFund) ? relatedFund[0]?.name : relatedFund?.name) ?? "Online Giving";
  return <div className="mx-auto max-w-2xl space-y-4"><Card className="overflow-hidden"><div className="bg-navy-deep p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Hamburg Ghana SDA Church</p><h1 className="mt-2 text-2xl font-bold">Online Giving Receipt</h1><p className="mt-1 text-sm text-blue-100">Hamburg, Germany</p></div><div className="space-y-5 p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-400">Receipt Number</p><p className="mt-1 font-bold text-navy">{String(payment.receipt_number)}</p></div><StatusBadge tone={payment.status === "completed" ? "green" : "gold"}>{String(payment.status)}</StatusBadge></div><div className="grid gap-4 border-y border-slate-100 py-5 sm:grid-cols-2">{[["Donor", payment.donor_name], ["Email", payment.donor_email], ["Fund", fund], ["Date", String(payment.created_at).slice(0, 10)]].map(([label, value]) => <div key={String(label)}><p className="text-xs uppercase tracking-wide text-slate-400">{String(label)}</p><p className="mt-1 text-sm font-semibold text-navy">{String(value)}</p></div>)}</div><div className="flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-400">Amount</p><p className="mt-1 text-3xl font-bold text-churchblue">{currency.format(Number(payment.amount))}</p></div><p className="text-right text-xs text-slate-400">{payment.status === "completed" ? "Payment confirmed. Thank you for your faithful stewardship." : "Pending payment confirmation. This receipt is not proof of completed payment."}</p></div></div></Card><div className="flex justify-between print:hidden"><Link className="inline-flex h-10 items-center px-2 text-sm font-bold text-churchblue" href="/giving">Back to Online Giving</Link><Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Receipt</Button></div></div>;
}
