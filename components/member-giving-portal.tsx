"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Printer, Search, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";

type GivingRecord = {
  id: string;
  date: string;
  amount: number;
  paymentType: string;
  receiptNumber: string;
  recordedBy: string;
  source: "Finance" | "Online";
};

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const givingTypes = ["Tithe", "Offering", "Building Fund", "Mission Fund", "Thanksgiving", "Health & Disaster", "Harvest", "Evangelism"];
const typeAliases: Record<string, string> = {
  tithe: "Tithe",
  offering: "Offering",
  donation: "Donation",
  welfare: "Welfare",
  other_church_payment: "Other Church Payment",
  "mission offering": "Mission Fund",
  missions: "Mission Fund",
  "thanksgiving offering": "Thanksgiving",
};

function labelize(value: string | null | undefined) {
  if (!value) return "Church Payment";
  const key = value.toLowerCase();
  return typeAliases[key] ?? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relatedName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return String((value[0] as { name?: unknown; full_name?: unknown } | undefined)?.name ?? (value[0] as { full_name?: unknown } | undefined)?.full_name ?? "");
  return String((value as { name?: unknown; full_name?: unknown }).name ?? (value as { full_name?: unknown }).full_name ?? "");
}

function recordMonth(record: GivingRecord) {
  return record.date.slice(0, 7);
}

export function MemberGivingPortal() {
  const [records, setRecords] = useState<GivingRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All Types");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [canViewAll, setCanViewAll] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const allAccess = (roleRows ?? []).some(({ role }) => ["super_admin", "treasurer"].includes(role));
      setCanViewAll(allAccess);

      const [financeResult, onlineResult] = await Promise.all([
        supabase
          .from("finance_transactions")
          .select("id, transaction_date, transaction_type, amount, reference_number, recorded_by_profile:profiles!finance_transactions_recorded_by_fkey(full_name), finance_categories(name)")
          .order("transaction_date", { ascending: false }),
        supabase
          .from("online_giving_payments")
          .select("id, created_at, completed_at, amount, receipt_number, status, funds(name)")
          .eq("status", "completed")
          .order("created_at", { ascending: false }),
      ]);

      if (financeResult.error || onlineResult.error) {
        setError(financeResult.error?.message ?? onlineResult.error?.message ?? "Unable to load giving history.");
        setLoading(false);
        return;
      }

      const financeRows = (financeResult.data ?? []).map((row) => ({
        id: row.id,
        date: row.transaction_date,
        amount: Number(row.amount),
        paymentType: relatedName(row.finance_categories) || labelize(row.transaction_type),
        receiptNumber: row.reference_number || row.id.slice(0, 8).toUpperCase(),
        recordedBy: relatedName(row.recorded_by_profile) || "Church Treasurer",
        source: "Finance" as const,
      }));
      const onlineRows = (onlineResult.data ?? []).map((row) => ({
        id: row.id,
        date: String(row.completed_at ?? row.created_at).slice(0, 10),
        amount: Number(row.amount),
        paymentType: labelize(relatedName(row.funds)),
        receiptNumber: row.receipt_number,
        recordedBy: "Online Giving",
        source: "Online" as const,
      }));
      setRecords([...financeRows, ...onlineRows].sort((left, right) => right.date.localeCompare(left.date)));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) =>
      (selectedType === "All Types" || record.paymentType === selectedType)
      && (!normalized || Object.values(record).some((value) => String(value).toLowerCase().includes(normalized))),
    );
  }, [query, records, selectedType]);

  const total = filtered.reduce((sum, record) => sum + record.amount, 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear().toString();
  const monthlyTotal = records.filter((record) => recordMonth(record) === currentMonth).reduce((sum, record) => sum + record.amount, 0);
  const yearlyTotal = records.filter((record) => record.date.startsWith(currentYear)).reduce((sum, record) => sum + record.amount, 0);
  const typeTotals = givingTypes.map((type) => ({ type, value: records.filter((record) => record.paymentType === type).reduce((sum, record) => sum + record.amount, 0) }));
  const yearlyRows = Object.entries(records.reduce<Record<string, number>>((acc, record) => {
    const year = record.date.slice(0, 4);
    acc[year] = (acc[year] ?? 0) + record.amount;
    return acc;
  }, {})).sort(([left], [right]) => right.localeCompare(left));

  async function downloadStatement() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church - Contribution Statement", 14, 16);
    document.setFontSize(9);
    document.text(`Total: ${currency.format(total)} | Records: ${filtered.length}`, 14, 23);
    autoTableModule.default(document, {
      startY: 30,
      head: [["Date", "Payment Type", "Receipt Number", "Recorded By", "Amount"]],
      body: filtered.map((record) => [record.date, record.paymentType, record.receiptNumber, record.recordedBy, currency.format(record.amount)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save("Hamburg-Ghana-SDA-Contribution-Statement.pdf");
    setNotice("Contribution statement downloaded.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <PageHeading title="Member Giving Portal" description={canViewAll ? "View all member contribution records and statements." : "View your personal tithe, offerings, funds, and contribution statements."} />
        <Button onClick={downloadStatement}><Download className="h-4 w-4" /> Download Contribution Statement</Button>
      </div>
      {notice && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Filtered Total" value={currency.format(total)} icon={WalletCards} />
        <SummaryCard label="Monthly Summary" value={currency.format(monthlyTotal)} icon={FileText} />
        <SummaryCard label="Yearly Summary" value={currency.format(yearlyTotal)} icon={FileText} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {typeTotals.map(({ type, value }) => <Card className="p-4" key={type}><p className="text-sm font-semibold text-navy">{type}</p><p className="mt-2 text-xl font-bold text-churchblue">{currency.format(value)}</p></Card>)}
      </section>

      <Card>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row">
          <label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search receipt, type, date, or recorder..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none" value={selectedType} onChange={(event) => setSelectedType(event.target.value)}><option>All Types</option>{givingTypes.map((type) => <option key={type}>{type}</option>)}</select>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Statement</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Date", "Payment Type", "Receipt Number", "Recorded By", "Source", "Amount"].map((label) => <th className="px-5 py-3.5 font-semibold" key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {loading && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={6}>Loading giving history...</td></tr>}
              {filtered.map((record) => <tr className="border-b border-slate-100 last:border-0" key={`${record.source}-${record.id}`}><td className="px-5 py-4 font-semibold text-navy">{record.date}</td><td className="px-5 py-4"><StatusBadge tone="gold">{record.paymentType}</StatusBadge></td><td className="px-5 py-4 text-slate-600">{record.receiptNumber}</td><td className="px-5 py-4 text-slate-600">{record.recordedBy}</td><td className="px-5 py-4 text-slate-500">{record.source}</td><td className="px-5 py-4 font-bold text-navy">{currency.format(record.amount)}</td></tr>)}
              {!loading && filtered.length === 0 && <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={6}>No giving records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader><div><h2 className="font-bold text-navy">Yearly Summary</h2><p className="mt-1 text-xs text-slate-400">Contribution totals grouped by year</p></div></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">{yearlyRows.length ? yearlyRows.map(([year, value]) => <div className="rounded-lg border border-slate-100 p-4" key={year}><p className="text-sm font-semibold text-slate-500">{year}</p><p className="mt-1 text-xl font-bold text-navy">{currency.format(value)}</p></div>) : <p className="text-sm text-slate-500">No yearly records available.</p>}</CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FileText }) {
  return <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{value}</p></div></Card>;
}
