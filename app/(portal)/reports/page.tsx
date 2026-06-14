"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChartNoAxesCombined, CircleDollarSign, ClipboardCheck, Download, FileSpreadsheet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles, type AppRole } from "@/lib/auth";

type MembershipRow = { id: string; name: string; status: string; department: string; joinedOn: string; createdAt: string };
type AttendanceRow = { id: string; date: string; service: string; department: string; memberName: string; visitorName: string; status: string };
type FinanceRow = { id: string; date: string; category: string; memberName: string; amount: number; type: string };
type DepartmentRow = { id: string; name: string; members: number; budget: number; spent: number; expenses: number; completed: number; attendance: number; visitors: number; status: string };
type ReportId = "membership" | "attendance" | "giving" | "ministry";

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const reportDefinitions: Record<ReportId, { title: string; body: string; roles: AppRole[] }> = {
  membership: { title: "Membership Report", body: "Member totals, active members, department distribution, and growth.", roles: ["super_admin", "pastor", "secretary", "church_clerk"] },
  attendance: { title: "Attendance Summary", body: "Attendance trends, monthly attendance, department attendance, and visitors.", roles: ["super_admin", "pastor", "secretary", "church_clerk", "elder"] },
  giving: { title: "Giving Statement", body: "Tithe, offering, donations, and member contribution summaries.", roles: ["super_admin", "pastor", "treasurer"] },
  ministry: { title: "Ministry Overview", body: "Department statistics, budgets, expenses, and performance.", roles: ["super_admin", "pastor", "secretary", "treasurer", "department_head"] },
};

function relatedName(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) return relatedName(value[0]);
  const row = value as { name?: unknown; full_name?: unknown; departments?: unknown; finance_categories?: unknown };
  return String(row.name ?? row.full_name ?? relatedName(row.departments) ?? relatedName(row.finance_categories) ?? "");
}

function memberName(row: { full_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }) {
  return row.full_name || `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.email || "Unnamed Member";
}

function monthKey(value: string) {
  return value?.slice(0, 7) || "Unknown";
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function canAccess(roles: AppRole[], reportId: ReportId) {
  return roles.includes("super_admin") || reportDefinitions[reportId].roles.some((role) => roles.includes(role));
}

function totalBy<T>(rows: T[], key: (row: T) => string, value: (row: T) => number = () => 1) {
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(key(row) || "Unassigned", (totals.get(key(row) || "Unassigned") ?? 0) + value(row)));
  return [...totals.entries()].sort((left, right) => right[1] - left[1]);
}

function downloadExcel(filename: string, title: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const htmlRows = [
    `<tr><th colspan="${headers.length}">${escape(title)}</th></tr>`,
    `<tr>${headers.map((header) => `<th>${escape(header)}</th>`).join("")}</tr>`,
    ...rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`),
  ].join("");
  const blob = new Blob([`<html><head><meta charset="utf-8" /></head><body><table>${htmlRows}</table></body></html>`], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(filename: string, title: string, headers: string[], rows: (string | number)[][]) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const document = new jsPDF({ orientation: headers.length > 5 ? "landscape" : "portrait" });
  document.setFontSize(15);
  document.text(title, 14, 16);
  document.setFontSize(9);
  document.text(`Generated ${new Date().toLocaleString()}`, 14, 23);
  autoTableModule.default(document, { startY: 30, head: [headers], body: rows, styles: { fontSize: 8 }, headStyles: { fillColor: [8, 41, 76] } });
  document.save(filename);
}

export default function ReportsPage() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [members, setMembers] = useState<MembershipRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [activeReport, setActiveReport] = useState<ReportId>("membership");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReports() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      let roleNames: AppRole[] = [];
      if (user) {
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        roleNames = normalizeRoles((roleRows ?? []).map(({ role }) => role));
        setRoles(roleNames);
      }

      const canLoadMembership = canAccess(roleNames, "membership");
      const canLoadAttendance = canAccess(roleNames, "attendance");
      const canLoadGiving = canAccess(roleNames, "giving");
      const canLoadMinistry = canAccess(roleNames, "ministry");

      const [memberResult, attendanceResult, financeResult, departmentResult, membershipResult, budgetResult, expenseResult, performanceResult] = await Promise.all([
        canLoadMembership ? supabase.from("members").select("id, full_name, first_name, last_name, email, status, joined_on, created_at, department_members(departments(name))").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        canLoadAttendance ? supabase.from("attendance_entries").select("id, status, visitor_name, checked_in_at, attendance_sessions(service_name, service_date), members(full_name, first_name, last_name, email), departments(name)").order("checked_in_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        canLoadGiving ? supabase.from("finance_transactions").select("id, transaction_date, transaction_type, amount, members(full_name), finance_categories(name)").order("transaction_date", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        canLoadMinistry ? supabase.from("departments").select("id, name").order("name") : Promise.resolve({ data: [], error: null }),
        canLoadMinistry ? supabase.from("department_members").select("department_id") : Promise.resolve({ data: [], error: null }),
        canLoadMinistry ? supabase.from("department_budgets").select("department_id, approved_budget_amount, amount_spent, budget_status") : Promise.resolve({ data: [], error: null }),
        canLoadMinistry ? supabase.from("department_expenses").select("department_id, amount") : Promise.resolve({ data: [], error: null }),
        canLoadMinistry ? supabase.from("department_performance").select("department_id, completed_activities, attendance_count, visitor_engagement, performance_status") : Promise.resolve({ data: [], error: null }),
      ]);

      const firstError = [memberResult, attendanceResult, financeResult, departmentResult].find((result) => result.error)?.error?.message;
      if (firstError) setError(firstError);

      setMembers((memberResult.data ?? []).map((row) => ({
        id: row.id,
        name: memberName(row),
        status: titleCase(row.status ?? "unknown"),
        department: relatedName((row.department_members as unknown[] | null)?.[0] ?? null) || "Unassigned",
        joinedOn: row.joined_on ?? "",
        createdAt: row.created_at ?? "",
      })));

      setAttendance((attendanceResult.data ?? []).map((row) => {
        const session = Array.isArray(row.attendance_sessions) ? row.attendance_sessions[0] : row.attendance_sessions;
        const member = Array.isArray(row.members) ? row.members[0] : row.members;
        return {
          id: row.id,
          date: session?.service_date ?? row.checked_in_at?.slice(0, 10) ?? "",
          service: session?.service_name ?? "Attendance",
          department: relatedName(row.departments) || "Unassigned",
          memberName: member ? memberName(member) : "",
          visitorName: row.visitor_name ?? "",
          status: titleCase(row.status ?? ""),
        };
      }));

      setFinance((financeResult.data ?? []).map((row) => ({
        id: row.id,
        date: row.transaction_date,
        category: relatedName(row.finance_categories) || titleCase(row.transaction_type ?? "income"),
        memberName: relatedName(row.members) || "Unassigned",
        amount: Number(row.amount),
        type: titleCase(row.transaction_type ?? "income"),
      })));

      const memberCounts = new Map<string, number>();
      (membershipResult.data ?? []).forEach((row) => memberCounts.set(row.department_id, (memberCounts.get(row.department_id) ?? 0) + 1));
      const budgetByDepartment = new Map<string, { budget: number; spent: number; status: string }>();
      (budgetResult.data ?? []).forEach((row) => {
        const current = budgetByDepartment.get(row.department_id) ?? { budget: 0, spent: 0, status: "" };
        budgetByDepartment.set(row.department_id, { budget: current.budget + Number(row.approved_budget_amount), spent: current.spent + Number(row.amount_spent), status: row.budget_status ?? current.status });
      });
      const expensesByDepartment = new Map<string, number>();
      (expenseResult.data ?? []).forEach((row) => expensesByDepartment.set(row.department_id, (expensesByDepartment.get(row.department_id) ?? 0) + Number(row.amount)));
      const performanceByDepartment = new Map<string, { completed: number; attendance: number; visitors: number; status: string }>();
      (performanceResult.data ?? []).forEach((row) => {
        const current = performanceByDepartment.get(row.department_id) ?? { completed: 0, attendance: 0, visitors: 0, status: "" };
        performanceByDepartment.set(row.department_id, {
          completed: current.completed + Number(row.completed_activities),
          attendance: current.attendance + Number(row.attendance_count),
          visitors: current.visitors + Number(row.visitor_engagement),
          status: row.performance_status ?? current.status,
        });
      });
      setDepartments((departmentResult.data ?? []).map((row) => {
        const budget = budgetByDepartment.get(row.id);
        const performance = performanceByDepartment.get(row.id);
        return {
          id: row.id,
          name: row.name,
          members: memberCounts.get(row.id) ?? 0,
          budget: budget?.budget ?? 0,
          spent: budget?.spent ?? 0,
          expenses: expensesByDepartment.get(row.id) ?? 0,
          completed: performance?.completed ?? 0,
          attendance: performance?.attendance ?? 0,
          visitors: performance?.visitors ?? 0,
          status: titleCase(performance?.status || budget?.status || "not recorded"),
        };
      }));
      setLoading(false);
    }
    void loadReports();
  }, []);

  const membershipRows = useMemo(() => {
    const total = members.length;
    const active = members.filter((member) => member.status.toLowerCase() === "active").length;
    const byDepartment = totalBy(members, (member) => member.department);
    const growth = totalBy(members, (member) => monthKey(member.joinedOn || member.createdAt));
    return {
      summary: [["Total Members", total], ["Active Members", active], ["Departments Represented", byDepartment.length], ["New Members This Month", growth.find(([month]) => month === new Date().toISOString().slice(0, 7))?.[1] ?? 0]],
      table: byDepartment.map(([department, count]) => [department, count]),
      growth,
    };
  }, [members]);

  const attendanceRows = useMemo(() => {
    const present = attendance.filter((row) => ["Present", "Late"].includes(row.status));
    const visitorAttendance = attendance.filter((row) => row.visitorName).length;
    return {
      summary: [["Attendance Records", attendance.length], ["Present/Late", present.length], ["Visitor Attendance", visitorAttendance], ["Departments", totalBy(attendance, (row) => row.department).length]],
      monthly: totalBy(present, (row) => monthKey(row.date)),
      department: totalBy(present, (row) => row.department),
      services: totalBy(present, (row) => row.service),
    };
  }, [attendance]);

  const givingRows = useMemo(() => {
    const categoryTotals = totalBy(finance, (row) => row.category, (row) => row.amount);
    const memberTotals = totalBy(finance, (row) => row.memberName, (row) => row.amount).slice(0, 25);
    const byCategory = (needle: string) => finance.filter((row) => row.category.toLowerCase().includes(needle)).reduce((sum, row) => sum + row.amount, 0);
    const donations = finance.filter((row) => ["donation", "thanksgiving", "welfare", "mission", "building"].some((needle) => row.category.toLowerCase().includes(needle))).reduce((sum, row) => sum + row.amount, 0);
    return {
      summary: [["Tithe Totals", currency.format(byCategory("tithe"))], ["Offering Totals", currency.format(byCategory("offering"))], ["Donations", currency.format(donations)], ["Total Giving", currency.format(finance.reduce((sum, row) => sum + row.amount, 0))]],
      categoryTotals,
      memberTotals,
    };
  }, [finance]);

  const ministryRows = useMemo(() => ({
    summary: [["Departments", departments.length], ["Total Budget", currency.format(departments.reduce((sum, row) => sum + row.budget, 0))], ["Total Expenses", currency.format(departments.reduce((sum, row) => sum + row.expenses, 0))], ["Completed Activities", departments.reduce((sum, row) => sum + row.completed, 0)]],
    table: departments.map((row) => [row.name, row.members, currency.format(row.budget), currency.format(row.expenses), row.completed, row.attendance, row.visitors, row.status]),
  }), [departments]);

  const exports = {
    membership: {
      headers: ["Department", "Members"],
      rows: membershipRows.table,
      extra: [["Metric", "Value"], ...membershipRows.summary, ["Growth Month", "Members"], ...membershipRows.growth],
    },
    attendance: {
      headers: ["Month", "Attendance"],
      rows: attendanceRows.monthly,
      extra: [["Metric", "Value"], ...attendanceRows.summary, ["Department", "Attendance"], ...attendanceRows.department, ["Service", "Attendance"], ...attendanceRows.services],
    },
    giving: {
      headers: ["Category", "Amount"],
      rows: givingRows.categoryTotals.map(([label, amount]) => [label, currency.format(amount)]),
      extra: [["Metric", "Value"], ...givingRows.summary, ["Member", "Total"], ...givingRows.memberTotals.map(([label, amount]) => [label, currency.format(amount)])],
    },
    ministry: {
      headers: ["Department", "Members", "Budget", "Expenses", "Completed Activities", "Attendance", "Visitors", "Status"],
      rows: ministryRows.table,
      extra: [["Metric", "Value"], ...ministryRows.summary],
    },
  } satisfies Record<ReportId, { headers: string[]; rows: (string | number)[][]; extra: (string | number)[][] }>;

  function exportRows(reportId: ReportId, kind: "pdf" | "excel") {
    const definition = reportDefinitions[reportId];
    const data = exports[reportId];
    const rows = [...data.extra, [], data.headers, ...data.rows];
    if (kind === "excel") downloadExcel(`${definition.title.replaceAll(" ", "-")}.xls`, definition.title, ["Item", "Value", "C", "D", "E", "F", "G", "H"].slice(0, Math.max(2, data.headers.length)), rows);
    else void downloadPdf(`${definition.title.replaceAll(" ", "-")}.pdf`, definition.title, data.headers, data.rows);
  }

  const activeAllowed = canAccess(roles, activeReport);

  return (
    <div className="space-y-6">
      <PageHeading title="Reports" description="Generate and export church administration reports." />
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard id="membership" active={activeReport === "membership"} icon={Users} loading={loading} roles={roles} onExport={exportRows} onSelect={setActiveReport} />
        <ReportCard id="attendance" active={activeReport === "attendance"} icon={ClipboardCheck} loading={loading} roles={roles} onExport={exportRows} onSelect={setActiveReport} />
        <ReportCard id="giving" active={activeReport === "giving"} icon={CircleDollarSign} loading={loading} roles={roles} onExport={exportRows} onSelect={setActiveReport} />
        <ReportCard id="ministry" active={activeReport === "ministry"} icon={ChartNoAxesCombined} loading={loading} roles={roles} onExport={exportRows} onSelect={setActiveReport} />
      </div>
      <Card className="p-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <BarChart3 className="h-5 w-5 text-churchblue" />
          <div><h2 className="font-bold text-navy">{reportDefinitions[activeReport].title}</h2><p className="mt-1 text-sm text-slate-500">{reportDefinitions[activeReport].body}</p></div>
        </div>
        {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading reports...</p> : !activeAllowed ? <p className="py-10 text-center text-sm font-semibold text-slate-500">You do not have access to this report.</p> : <ReportDetails reportId={activeReport} membership={membershipRows} attendance={attendanceRows} giving={givingRows} ministry={ministryRows} />}
      </Card>
    </div>
  );
}

function ReportCard({ id, active, icon: Icon, loading, roles, onExport, onSelect }: { id: ReportId; active: boolean; icon: typeof Users; loading: boolean; roles: AppRole[]; onExport: (id: ReportId, kind: "pdf" | "excel") => void; onSelect: (id: ReportId) => void }) {
  const definition = reportDefinitions[id];
  const allowed = canAccess(roles, id);
  return <Card className={`p-5 ${active ? "ring-2 ring-churchblue" : ""}`}><div className="flex items-start justify-between gap-3"><button className="rounded-lg bg-blue-50 p-3 text-churchblue" type="button" onClick={() => onSelect(id)}><Icon className="h-5 w-5" /></button><StatusBadge tone={allowed ? "green" : "slate"}>{allowed ? "Live" : "Restricted"}</StatusBadge></div><button className="mt-5 text-left font-bold text-navy" type="button" onClick={() => onSelect(id)}>{definition.title}</button><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{definition.body}</p><div className="mt-4 flex flex-wrap gap-2"><Button disabled={loading || !allowed} size="sm" variant="outline" onClick={() => onExport(id, "pdf")}><Download className="h-4 w-4" /> PDF</Button><Button disabled={loading || !allowed} size="sm" variant="outline" onClick={() => onExport(id, "excel")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button></div></Card>;
}

function ReportDetails({ reportId, membership, attendance, giving, ministry }: { reportId: ReportId; membership: { summary: (string | number)[][]; table: (string | number)[][]; growth: (string | number)[][] }; attendance: { summary: (string | number)[][]; monthly: (string | number)[][]; department: (string | number)[][]; services: (string | number)[][] }; giving: { summary: (string | number)[][]; categoryTotals: [string, number][]; memberTotals: [string, number][] }; ministry: { summary: (string | number)[][]; table: (string | number)[][] } }) {
  if (reportId === "membership") return <ReportLayout summary={membership.summary} sections={[["Members by Department", ["Department", "Members"], membership.table], ["Member Growth", ["Month", "Members"], membership.growth]]} />;
  if (reportId === "attendance") return <ReportLayout summary={attendance.summary} sections={[["Monthly Attendance", ["Month", "Attendance"], attendance.monthly], ["Department Attendance", ["Department", "Attendance"], attendance.department], ["Attendance by Service/Event", ["Service/Event", "Attendance"], attendance.services]]} />;
  if (reportId === "giving") return <ReportLayout summary={giving.summary} sections={[["Giving by Category", ["Category", "Amount"], giving.categoryTotals.map(([label, amount]) => [label, currency.format(amount)])], ["Member Contribution Summary", ["Member", "Total"], giving.memberTotals.map(([label, amount]) => [label, currency.format(amount)])]]} />;
  return <ReportLayout summary={ministry.summary} sections={[["Department Ministry Overview", ["Department", "Members", "Budget", "Expenses", "Completed", "Attendance", "Visitors", "Status"], ministry.table]]} />;
}

function ReportLayout({ summary, sections }: { summary: (string | number)[][]; sections: [string, string[], (string | number)[][]][] }) {
  return <div className="space-y-5 pt-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.map(([label, value]) => <div className="rounded-lg border border-slate-100 bg-slate-50 p-4" key={String(label)}><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-2 text-xl font-bold text-navy">{value}</p></div>)}</div>{sections.map(([title, headers, rows]) => <div className="overflow-hidden rounded-lg border border-slate-100" key={title}><h3 className="border-b border-slate-100 bg-white px-4 py-3 font-bold text-navy">{title}</h3><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">{headers.map((header) => <th className="px-4 py-3" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-t border-slate-100" key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td className={`px-4 py-3 ${cellIndex === 0 ? "font-semibold text-navy" : "text-slate-600"}`} key={`${title}-${index}-${cellIndex}`}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={headers.length}>No report data found.</td></tr>}</tbody></table></div></div>)}</div>;
}
