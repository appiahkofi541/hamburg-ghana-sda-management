"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/status-badge";

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relatedName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return String((value[0] as { full_name?: unknown; name?: unknown } | undefined)?.full_name ?? (value[0] as { name?: unknown } | undefined)?.name ?? "");
  return String((value as { full_name?: unknown; name?: unknown }).full_name ?? (value as { name?: unknown }).name ?? "");
}

export function FinancePaymentReceipt({ id }: { id: string }) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>();
  const [log, setLog] = useState<Record<string, unknown> | null>();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) return;
      const [{ data: paymentRow }, { data: logRow }] = await Promise.all([
        supabase.from("finance_transactions").select("*, finance_accounts(name), members(full_name)").eq("id", id).maybeSingle(),
        supabase.from("whatsapp_payment_notification_logs").select("*").eq("payment_id", id).maybeSingle(),
      ]);
      setPayment(paymentRow);
      setLog(logRow);
    }
    load();
  }, [id]);

  if (payment === undefined) return <p className="p-8 text-center text-sm text-slate-500">Loading payment receipt...</p>;
  if (!payment) return <Card className="p-8 text-center"><p className="text-sm text-slate-500">Payment receipt not found.</p><Link className="mt-4 inline-block font-bold text-churchblue" href="/offerings">Return to Finance</Link></Card>;

  const paymentType = labelize(String(payment.transaction_type));
  const account = relatedName(payment.finance_accounts);
  const member = relatedName(payment.members) || "Not linked to member";
  const method = payment.payment_method ? labelize(String(payment.payment_method)) : "Cash";
  const notes = String(payment.notes || payment.description || "");
  const status = log ? labelize(String(log.status)) : "Not Sent";

  return <div className="mx-auto max-w-2xl space-y-4"><Card className="overflow-hidden"><div className="bg-navy-deep p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Hamburg Ghana SDA Church</p><h1 className="mt-2 text-2xl font-bold">Finance Payment Receipt</h1><p className="mt-1 text-sm text-blue-100">Hamburg, Germany</p></div><div className="space-y-5 p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-400">Receipt / Reference</p><p className="mt-1 font-bold text-navy">{String(payment.reference_number || payment.id).slice(0, 18)}</p></div><StatusBadge tone="gold">{paymentType}</StatusBadge></div><div className="grid gap-4 border-y border-slate-100 py-5 sm:grid-cols-2">{[["Member", member], ["Account", account], ["Payment Date", String(payment.transaction_date)], ["Payment Method", method], ["WhatsApp Status", status], ["Notes", notes || "-"]].map(([label, value]) => <div key={String(label)}><p className="text-xs uppercase tracking-wide text-slate-400">{String(label)}</p><p className="mt-1 text-sm font-semibold text-navy">{String(value)}</p></div>)}</div><div className="flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-400">Amount</p><p className="mt-1 text-3xl font-bold text-churchblue">{currency.format(Number(payment.amount))}</p></div><p className="max-w-xs text-right text-xs text-slate-400">{log?.error_message ? String(log.error_message) : "Thank you for your faithful stewardship. God bless you."}</p></div></div></Card><div className="flex justify-between print:hidden"><Link className="inline-flex h-10 items-center px-2 text-sm font-bold text-churchblue" href="/offerings">Back to Finance</Link><Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Receipt</Button></div></div>;
}
