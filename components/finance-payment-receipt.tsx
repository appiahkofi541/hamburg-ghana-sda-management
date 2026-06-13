"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/status-badge";
import { churchLocation, fallbackChurchProfile, loadPublicChurchProfile, type ChurchProfile } from "@/lib/church-profile";

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relatedName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return String((value[0] as { full_name?: unknown; name?: unknown } | undefined)?.full_name ?? (value[0] as { name?: unknown } | undefined)?.name ?? "");
  return String((value as { full_name?: unknown; name?: unknown }).full_name ?? (value as { name?: unknown }).name ?? "");
}

function relatedRow(value: unknown) {
  if (!value) return null;
  return (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined;
}

function memberDetails(value: unknown) {
  const member = relatedRow(value);
  if (!member) return { name: "Not linked to member", number: "-" };
  const fallbackName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
  return {
    name: String(member.full_name || fallbackName || "Not linked to member"),
    number: String(member.member_number || member.member_id || "-"),
  };
}

function profileName(value: unknown) {
  const profile = relatedRow(value);
  if (!profile) return "";
  return String(profile.full_name || profile.email || "");
}

export function FinancePaymentReceipt({ id }: { id: string }) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>();
  const [log, setLog] = useState<Record<string, unknown> | null>();
  const [church, setChurch] = useState<ChurchProfile>(fallbackChurchProfile);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        setPayment(null);
        setLoadError("Supabase is not configured for contribution receipts.");
        return;
      }
      const [paymentResult, logResult, profile] = await Promise.all([
        supabase
          .from("finance_transactions")
          .select("id, transaction_date, transaction_type, amount, currency, payment_method, notes, description, reference_number, account:finance_accounts!finance_transactions_account_id_fkey(name), finance_categories!finance_transactions_category_id_fkey(name), members!finance_transactions_member_id_fkey(full_name, first_name, last_name, member_number), recorded_by_profile:profiles!finance_transactions_recorded_by_fkey(full_name, email)")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("whatsapp_payment_notification_logs").select("*").eq("payment_id", id).maybeSingle(),
        loadPublicChurchProfile(supabase),
      ]);
      setLoadError(paymentResult.error ? paymentResult.error.message : "");
      setPayment((paymentResult.data ?? null) as Record<string, unknown> | null);
      setLog(logResult.error ? null : (logResult.data as Record<string, unknown> | null));
      setChurch(profile);
    }
    load();
  }, [id]);

  if (payment === undefined) return <p className="p-8 text-center text-sm text-slate-500">Loading payment receipt...</p>;
  if (loadError) return <Card className="p-8 text-center"><p className="font-semibold text-navy">Unable to load payment receipt.</p><p className="mt-2 text-sm text-slate-500">{loadError}</p><Link className="mt-4 inline-block font-bold text-churchblue" href="/contributions">Return to Contributions</Link></Card>;
  if (!payment) return <Card className="p-8 text-center"><p className="text-sm text-slate-500">Payment receipt not found.</p><Link className="mt-4 inline-block font-bold text-churchblue" href="/contributions">Return to Contributions</Link></Card>;

  const paymentType = relatedName(payment.finance_categories) || labelize(String(payment.transaction_type));
  const account = relatedName(payment.account);
  const member = memberDetails(payment.members);
  const method = payment.payment_method ? labelize(String(payment.payment_method)) : "Cash";
  const notes = String(payment.notes || payment.description || "");
  const status = log ? labelize(String(log.status)) : "Not Sent";
  const receiptNumber = String(payment.reference_number || String(payment.id).slice(0, 8).toUpperCase());
  const paymentDate = String(payment.transaction_date);
  const amount = currency.format(Number(payment.amount));
  const treasurer = profileName(payment.recorded_by_profile) || "Church Treasurer";

  async function downloadPdf() {
    const { jsPDF } = await import("jspdf");
    const document = new jsPDF();
    document.setFillColor(8, 41, 76);
    document.circle(22, 20, 9, "F");
    document.setTextColor(255, 255, 255);
    document.setFontSize(10);
    document.text("HG", 17.5, 23);
    document.setTextColor(8, 41, 76);
    document.setFontSize(17);
    document.text(church.church_name, 36, 18);
    document.setFontSize(11);
    document.text("Finance Payment Receipt", 36, 25);
    document.setTextColor(80, 90, 110);
    document.text(churchLocation(church) || church.country, 36, 31);
    document.setDrawColor(220, 170, 60);
    document.line(14, 38, 196, 38);
    const rows = [["Receipt No", receiptNumber], ["Member", member.name], ["Member No", member.number], ["Contribution Type", paymentType], ["Amount", amount], ["Payment Method", method], ["Date", paymentDate], ["Treasurer", treasurer], ["Account", account || "-"], ["Notes", notes || "-"]];
    let y = 50;
    rows.forEach(([label, value]) => {
      document.setTextColor(100, 116, 139);
      document.text(label, 18, y);
      document.setTextColor(8, 41, 76);
      document.text(document.splitTextToSize(String(value), 112), 72, y);
      y += 10;
    });
    document.setTextColor(80, 90, 110);
    document.text("Thank you for your faithful stewardship. God bless you.", 18, y + 8);
    document.line(120, y + 28, 188, y + 28);
    document.text("Treasurer Signature", 138, y + 35);
    document.save(`${church.short_name.replaceAll(" ", "-")}-Receipt-${receiptNumber}.pdf`);
  }

  return <div className="mx-auto max-w-2xl space-y-4"><Card className="overflow-hidden"><div className="flex items-center gap-4 bg-navy-deep p-6 text-white"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-white/10 text-lg font-black text-gold">{church.short_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "HG"}</div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{church.church_name}</p><h1 className="mt-2 text-2xl font-bold">Contribution Receipt</h1><p className="mt-1 text-sm text-blue-100">{churchLocation(church) || church.country}</p></div></div><div className="space-y-5 p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-400">Receipt / Reference</p><p className="mt-1 font-bold text-navy">{receiptNumber}</p></div><StatusBadge tone="gold">{paymentType}</StatusBadge></div><div className="grid gap-4 border-y border-slate-100 py-5 sm:grid-cols-2">{[["Member", member.name], ["Member Number", member.number], ["Contribution Type", paymentType], ["Account", account || "-"], ["Payment Date", paymentDate], ["Payment Method", method], ["Treasurer", treasurer], ["WhatsApp Status", status], ["Notes", notes || "-"]].map(([label, value]) => <div key={String(label)}><p className="text-xs uppercase tracking-wide text-slate-400">{String(label)}</p><p className="mt-1 text-sm font-semibold text-navy">{String(value)}</p></div>)}</div><div className="flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-400">Amount</p><p className="mt-1 text-3xl font-bold text-churchblue">{amount}</p></div><p className="max-w-xs text-right text-xs text-slate-400">{log?.error_message ? String(log.error_message) : "Thank you for your faithful stewardship. God bless you."}</p></div><div className="flex justify-end pt-8"><div className="w-56 border-t border-slate-300 pt-2 text-center text-xs font-semibold text-slate-500">{treasurer}<br /><span className="font-normal">Treasurer</span></div></div></div></Card><div className="flex justify-between gap-2 print:hidden"><Link className="inline-flex h-10 items-center px-2 text-sm font-bold text-churchblue" href="/contributions">Back to Contributions</Link><div className="flex gap-2"><Button variant="outline" onClick={downloadPdf}><Download className="h-4 w-4" /> Download PDF</Button><Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Receipt</Button></div></div></div>;
}
