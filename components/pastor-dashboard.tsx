"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck, CalendarDays, Church, CircleDollarSign, ClipboardCheck, Download, FileSpreadsheet,
  HeartHandshake, Landmark, ShieldCheck, TrendingUp, Users, UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type MetricCard = { label: string; value: string; note: string; icon: LucideIcon; tone: string };
type ChartPoint = { label: string; value: number; secondary?: number };
type Activity = { type: string; title: string; detail: string; date: string };
type DepartmentSummary = { id: string; name: string; leader: string; members: number; attendanceRate: number; status: string };
type UpcomingEvent = { id: string; title: string; startsAt: string; location: string; status: string };
type PastorDashboardData = {
  metrics: {
    totalMembers: number;
    activeMembers: number;
    baptizedThisYear: number;
    candidatesStudying: number;
    eventRegistrations: number;
    eventAttendanceRate: number;
    titheThisMonth: number;
    offeringsThisMonth: number;
    prayerPending: number;
    departmentsCount: number;
  };
  charts: {
    membershipGrowth: ChartPoint[];
    attendanceTrend: ChartPoint[];
    titheOfferingTrend: ChartPoint[];
    baptismTrend: ChartPoint[];
    eventParticipationTrend: ChartPoint[];
  };
  recentActivity: Activity[];
  departments: DepartmentSummary[];
  upcomingEvents: UpcomingEvent[];
  prayerSummary: { pending: number; answered: number; urgent: number };
};

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const emptyData: PastorDashboardData = {
  metrics: {
    totalMembers: 0,
    activeMembers: 0,
    baptizedThisYear: 0,
    candidatesStudying: 0,
    eventRegistrations: 0,
    eventAttendanceRate: 0,
    titheThisMonth: 0,
    offeringsThisMonth: 0,
    prayerPending: 0,
    departmentsCount: 0,
  },
  charts: {
    membershipGrowth: [],
    attendanceTrend: [],
    titheOfferingTrend: [],
    baptismTrend: [],
    eventParticipationTrend: [],
  },
  recentActivity: [],
  departments: [],
  upcomingEvents: [],
  prayerSummary: { pending: 0, answered: 0, urgent: 0 },
};

function monthKey(dateValue: string | null | undefined) {
  if (!dateValue) return "";
  return new Date(dateValue).toISOString().slice(0, 7);
}

function weekKey(dateValue: string | null | undefined) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start.toISOString().slice(5, 10);
}

function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-GB", { month: "short" }),
    };
  });
}

function groupCountByMonth(rows: { date?: string | null }[], count = 6) {
  const months = lastMonths(count);
  return months.map(({ key, label }) => ({ label, value: rows.filter((row) => monthKey(row.date) === key).length }));
}

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function isTithe(row: { transaction_type?: string | null; finance_categories?: unknown }) {
  const category = relatedName(row.finance_categories).toLowerCase();
  return row.transaction_type === "tithe" || category.includes("tithe");
}

function isOffering(row: { transaction_type?: string | null; finance_categories?: unknown }) {
  const category = relatedName(row.finance_categories).toLowerCase();
  return row.transaction_type === "offering" || category.includes("offering") || category.includes("thanksgiving") || category.includes("mission");
}

function relatedName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return relatedName(value[0]);
  const row = value as { name?: unknown; title?: unknown; full_name?: unknown };
  return String(row.name ?? row.title ?? row.full_name ?? "");
}

function relatedFullName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return relatedFullName(value[0]);
  const row = value as { full_name?: unknown; first_name?: unknown; last_name?: unknown };
  return String(row.full_name ?? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() ?? "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isLeaderRole(roles: AppRole[]) {
  return roles.some((role) => ["super_admin", "pastor", "elder"].includes(role));
}

export function PastorDashboard() {
  const [data, setData] = useState<PastorDashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const appRoles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
    setRoles(appRoles);
    if (!isLeaderRole(appRoles)) {
      setError("Access denied: Pastor Dashboard is available to Pastor, Elder, and Super Admin roles.");
      setLoading(false);
      return;
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const inOneYear = new Date(today.getTime() + 365 * 86400000).toISOString();

    const [
      membersResult,
      candidatesResult,
      baptismsResult,
      registrationsResult,
      eventAttendanceResult,
      attendanceResult,
      financeResult,
      prayerResult,
      departmentsResult,
      departmentMembersResult,
      eventsResult,
      profilesResult,
    ] = await Promise.all([
      supabase.from("members").select("id, full_name, status, joined_on, baptism_date, created_at").order("created_at", { ascending: false }),
      supabase.from("baptism_candidates").select("id, full_name, status, created_at").order("created_at", { ascending: false }),
      supabase.from("baptism_records").select("id, baptism_date, candidate_name, pastor, created_at").order("baptism_date", { ascending: false }),
      supabase.from("event_registrations").select("id, event_id, member_id, status, registration_date, events(title, starts_at), members(full_name, first_name, last_name)").order("registration_date", { ascending: false }),
      supabase.from("event_attendance").select("id, event_id, member_id, present, created_at, checked_in_at, events(title, starts_at), members(full_name, first_name, last_name)").order("created_at", { ascending: false }),
      supabase.from("attendance_entries").select("id, status, checked_in_at, department_id, attendance_sessions(service_date, service_name)").order("checked_in_at", { ascending: false }),
      supabase.from("finance_transactions").select("id, amount, transaction_type, transaction_date, finance_categories(name)").order("transaction_date", { ascending: false }),
      supabase.from("prayer_requests").select("id, title, request_text, status, created_at").order("created_at", { ascending: false }),
      supabase.from("departments").select("id, name, leader_id, is_active").order("name"),
      supabase.from("department_members").select("department_id, member_id"),
      supabase.from("events").select("id, title, starts_at, ends_at, location, status").gte("starts_at", today.toISOString()).lte("starts_at", inOneYear).order("starts_at").limit(10),
      supabase.from("profiles").select("id, full_name"),
    ]);

    const firstError = [
      membersResult, candidatesResult, baptismsResult, registrationsResult, eventAttendanceResult,
      attendanceResult, financeResult, prayerResult, departmentsResult, departmentMembersResult, eventsResult, profilesResult,
    ].find((result) => result.error)?.error;
    if (firstError) setError(`Some dashboard data could not be loaded: ${firstError.message}`);

    const members = membersResult.data ?? [];
    const candidates = candidatesResult.data ?? [];
    const baptisms = baptismsResult.data ?? [];
    const registrations = registrationsResult.data ?? [];
    const eventAttendance = eventAttendanceResult.data ?? [];
    const attendance = attendanceResult.data ?? [];
    const finance = financeResult.data ?? [];
    const prayer = prayerResult.data ?? [];
    const departments = departmentsResult.data ?? [];
    const departmentMembers = departmentMembersResult.data ?? [];
    const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name ?? "Unassigned"]));

    const monthlyFinance = lastMonths(6).map(({ key, label }) => {
      const rows = finance.filter((row) => monthKey(row.transaction_date) === key);
      return {
        label,
        value: rows.filter(isTithe).reduce((sum, row) => sum + Number(row.amount), 0),
        secondary: rows.filter(isOffering).reduce((sum, row) => sum + Number(row.amount), 0),
      };
    });
    const weeklyAttendanceKeys = Array.from(new Set(attendance.map((row) => weekKey((row.attendance_sessions as { service_date?: string } | null)?.service_date ?? row.checked_in_at)).filter(Boolean))).slice(0, 8).reverse();
    const attendanceTrend = weeklyAttendanceKeys.map((key) => ({
      label: key,
      value: attendance.filter((row) => weekKey((row.attendance_sessions as { service_date?: string } | null)?.service_date ?? row.checked_in_at) === key && ["present", "late"].includes(String(row.status))).length,
    }));

    const departmentSummary = departments.map((department) => {
      const memberCount = departmentMembers.filter((row) => row.department_id === department.id).length;
      const departmentAttendance = attendance.filter((row) => row.department_id === department.id);
      const present = departmentAttendance.filter((row) => ["present", "late"].includes(String(row.status))).length;
      return {
        id: department.id,
        name: department.name,
        leader: profiles.get(department.leader_id ?? "") ?? "Unassigned",
        members: memberCount,
        attendanceRate: departmentAttendance.length ? Math.round((present / departmentAttendance.length) * 100) : 0,
        status: department.is_active ? "Active" : "Inactive",
      };
    });

    const registeredCount = registrations.filter((row) => !["cancelled"].includes(String(row.status))).length;
    const presentEventCount = eventAttendance.filter((row) => row.present).length;
    const urgentPrayer = prayer.filter((row) => `${row.title} ${row.request_text}`.toLowerCase().match(/urgent|emergency|critical/)).length;
    const pendingPrayer = prayer.filter((row) => ["submitted", "praying", "pending"].includes(String(row.status))).length;

    setData({
      metrics: {
        totalMembers: members.length,
        activeMembers: members.filter((member) => String(member.status).toLowerCase() === "active").length,
        baptizedThisYear: baptisms.filter((row) => new Date(row.baptism_date).getFullYear() === currentYear).length,
        candidatesStudying: candidates.filter((row) => row.status === "studying").length,
        eventRegistrations: registeredCount,
        eventAttendanceRate: registeredCount ? Math.round((presentEventCount / registeredCount) * 100) : 0,
        titheThisMonth: finance.filter((row) => row.transaction_date >= monthStart && isTithe(row)).reduce((sum, row) => sum + Number(row.amount), 0),
        offeringsThisMonth: finance.filter((row) => row.transaction_date >= monthStart && isOffering(row)).reduce((sum, row) => sum + Number(row.amount), 0),
        prayerPending: pendingPrayer,
        departmentsCount: departments.length,
      },
      charts: {
        membershipGrowth: groupCountByMonth(members.map((member) => ({ date: member.joined_on ?? member.created_at }))),
        attendanceTrend,
        titheOfferingTrend: monthlyFinance,
        baptismTrend: groupCountByMonth(baptisms.map((row) => ({ date: row.baptism_date ?? row.created_at }))),
        eventParticipationTrend: lastMonths(6).map(({ key, label }) => ({
          label,
          value: registrations.filter((row) => monthKey(row.registration_date) === key).length,
          secondary: eventAttendance.filter((row) => monthKey(row.checked_in_at ?? row.created_at) === key && row.present).length,
        })),
      },
      recentActivity: [
        ...members.slice(0, 5).map((member) => ({ type: "New Member", title: member.full_name ?? "Member", detail: titleCase(member.status), date: member.created_at })),
        ...baptisms.slice(0, 5).map((row) => ({ type: "Recent Baptism", title: row.candidate_name || "Baptism record", detail: row.pastor || "Pastor not set", date: row.baptism_date })),
        ...registrations.slice(0, 5).map((row) => ({ type: "Event Registration", title: relatedName(row.events) || "Church Event", detail: relatedFullName(row.members) || "Member", date: row.registration_date })),
        ...eventAttendance.slice(0, 5).map((row) => ({ type: "Attendance Check-in", title: relatedName(row.events) || "Church Event", detail: relatedFullName(row.members) || "Member", date: row.checked_in_at ?? row.created_at })),
        ...prayer.slice(0, 5).map((row) => ({ type: "Prayer Request", title: row.title, detail: titleCase(row.status), date: row.created_at })),
      ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()).slice(0, 12),
      departments: departmentSummary,
      upcomingEvents: (eventsResult.data ?? []).map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at, location: event.location ?? "", status: titleCase(event.status) })),
      prayerSummary: {
        pending: pendingPrayer,
        answered: prayer.filter((row) => row.status === "answered").length,
        urgent: urgentPrayer,
      },
    });
    setLoading(false);
  }

  const cards = useMemo<MetricCard[]>(() => [
    { label: "Total Members", value: String(data.metrics.totalMembers), note: "All member records", icon: Users, tone: "bg-blue-50 text-churchblue" },
    { label: "Active Members", value: String(data.metrics.activeMembers), note: "Currently active", icon: UsersRound, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Baptized This Year", value: String(data.metrics.baptizedThisYear), note: String(new Date().getFullYear()), icon: Church, tone: "bg-purple-50 text-purple-700" },
    { label: "Candidates Studying", value: String(data.metrics.candidatesStudying), note: "Baptism candidates", icon: BadgeCheck, tone: "bg-amber-50 text-amber-700" },
    { label: "Event Registrations", value: String(data.metrics.eventRegistrations), note: "All active registrations", icon: CalendarDays, tone: "bg-blue-50 text-blue-700" },
    { label: "Event Attendance Rate", value: `${data.metrics.eventAttendanceRate}%`, note: "Checked in vs registered", icon: ClipboardCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Tithe This Month", value: currency.format(data.metrics.titheThisMonth), note: "Current month", icon: CircleDollarSign, tone: "bg-amber-50 text-amber-700" },
    { label: "Offerings This Month", value: currency.format(data.metrics.offeringsThisMonth), note: "Current month", icon: Landmark, tone: "bg-purple-50 text-purple-700" },
    { label: "Prayer Pending", value: String(data.metrics.prayerPending), note: "Submitted or praying", icon: HeartHandshake, tone: "bg-rose-50 text-rose-700" },
    { label: "Departments Count", value: String(data.metrics.departmentsCount), note: "Active and inactive", icon: ShieldCheck, tone: "bg-slate-100 text-slate-600" },
  ], [data.metrics]);

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church", 14, 14);
    document.setFontSize(10);
    document.text("Pastor Dashboard Report", 14, 21);
    autoTableModule.default(document, {
      startY: 28,
      head: [["Metric", "Value", "Note"]],
      body: cards.map((card) => [card.label, card.value, card.note]),
      headStyles: { fillColor: [8, 41, 76] },
    });
    autoTableModule.default(document, {
      startY: 112,
      head: [["Department", "Leader", "Members", "Attendance %", "Status"]],
      body: data.departments.map((department) => [department.name, department.leader, String(department.members), `${department.attendanceRate}%`, department.status]),
      headStyles: { fillColor: [21, 101, 192] },
    });
    document.save("Hamburg-Ghana-SDA-Pastor-Dashboard.pdf");
  }

  function exportExcel() {
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const metricRows = cards.map((card) => row([card.label, card.value, card.note])).join("");
    const departmentRows = data.departments.map((department) => row([department.name, department.leader, String(department.members), `${department.attendanceRate}%`, department.status])).join("");
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Dashboard Metrics"><Table>${row(["Metric", "Value", "Note"])}${metricRows}</Table></Worksheet><Worksheet ss:Name="Departments"><Table>${row(["Department", "Leader", "Members", "Attendance %", "Status"])}${departmentRows}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Hamburg-Ghana-SDA-Pastor-Dashboard.xls";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error && !isLeaderRole(roles)) return <Card className="p-8 text-center"><p className="font-bold text-navy">{error}</p><Link href="/dashboard"><Button className="mt-4">Back to Dashboard</Button></Link></Card>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <PageHeading title="Pastor Dashboard" description="Read-only pastoral overview of membership, attendance, finance, events, departments, and prayer needs." />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={loading} onClick={exportPdf}><Download className="h-4 w-4" /> PDF</Button>
          <Button type="button" variant="outline" disabled={loading} onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
        </div>
      </div>
      {error && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{error}</p>}
      <div className="rounded-xl bg-gradient-to-r from-navy to-churchblue p-6 text-white shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-blue-100">Hamburg Ghana SDA Church</p>
            <h2 className="mt-3 text-2xl font-bold">Pastoral Ministry Overview</h2>
            <p className="mt-2 max-w-3xl text-sm text-blue-100">A ministry dashboard for pastoral care, spiritual growth, participation, prayer needs, and department health.</p>
          </div>
          <StatusBadge tone="gold">{roles.includes("super_admin") ? "Super Admin: full access" : "Read-only"}</StatusBadge>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <Card className="p-5" key={label}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-navy">{loading ? "..." : value}</p></div>
              <div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-400">{note}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DashboardChart title="Membership Growth" description="New members by month" data={data.charts.membershipGrowth} />
        <DashboardChart title="Attendance Trend" description="Present and late attendance by week" data={data.charts.attendanceTrend} />
        <DashboardChart title="Tithe & Offering Trend" description="Tithe compared with offerings" data={data.charts.titheOfferingTrend} secondaryLabel="Offerings" currencyValues />
        <DashboardChart title="Baptism Trend" description="Baptisms by month" data={data.charts.baptismTrend} />
        <DashboardChart title="Event Participation Trend" description="Registrations compared with check-ins" data={data.charts.eventParticipationTrend} secondaryLabel="Check-ins" />
        <PrayerSummary summary={data.prayerSummary} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><div><h2 className="font-bold text-navy">Recent Activity</h2><p className="mt-1 text-xs text-slate-400">New members, baptisms, registrations, check-ins, and prayer requests.</p></div><TrendingUp className="h-5 w-5 text-churchblue" /></CardHeader>
          <CardContent className="space-y-3">{data.recentActivity.map((activity, index) => <div className="flex gap-3 rounded-lg border border-slate-100 p-3" key={`${activity.type}-${activity.title}-${index}`}><div className="mt-1 h-2.5 w-2.5 rounded-full bg-gold" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-navy">{activity.title}</p><StatusBadge tone="blue">{activity.type}</StatusBadge></div><p className="mt-1 text-xs text-slate-500">{activity.detail} | {formatDate(activity.date)}</p></div></div>)}{!loading && data.recentActivity.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No recent activity found.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><div><h2 className="font-bold text-navy">Upcoming Events</h2><p className="mt-1 text-xs text-slate-400">Next 10 scheduled church events.</p></div><Link href="/events" className="text-xs font-bold text-churchblue">View Calendar</Link></CardHeader>
          <CardContent className="space-y-3">{data.upcomingEvents.map((event) => <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3" key={event.id}><div className="w-12 rounded-lg bg-blue-50 py-2 text-center"><p className="text-[10px] font-bold text-churchblue">{new Date(event.startsAt).toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p><p className="text-lg font-bold text-navy">{new Date(event.startsAt).getDate()}</p></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-navy">{event.title}</p><p className="mt-1 text-xs text-slate-500">{event.location || "Location not set"} | {formatDate(event.startsAt)}</p></div><StatusBadge tone={event.status === "Published" ? "green" : "slate"}>{event.status}</StatusBadge></div>)}{!loading && data.upcomingEvents.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No upcoming events found.</p>}</CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><div><h2 className="font-bold text-navy">Department Summary</h2><p className="mt-1 text-xs text-slate-400">Department leaders, membership count, attendance health, and status.</p></div><ShieldCheck className="h-5 w-5 text-gold" /></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-y border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Department", "Leader", "Members", "Attendance %", "Status"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead>
            <tbody>{data.departments.map((department) => <tr className="border-b border-slate-100 last:border-0" key={department.id}><td className="px-5 py-4 font-bold text-navy">{department.name}</td><td className="px-5 py-4 text-slate-600">{department.leader}</td><td className="px-5 py-4 font-semibold text-navy">{department.members}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-2 w-28 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-churchblue to-gold" style={{ width: `${Math.max(4, department.attendanceRate)}%` }} /></div><span className="font-bold text-navy">{department.attendanceRate}%</span></div></td><td className="px-5 py-4"><StatusBadge tone={department.status === "Active" ? "green" : "slate"}>{department.status}</StatusBadge></td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function DashboardChart({ title, description, data, secondaryLabel, currencyValues = false }: { title: string; description: string; data: ChartPoint[]; secondaryLabel?: string; currencyValues?: boolean }) {
  const max = Math.max(...data.flatMap((item) => [item.value, item.secondary ?? 0]), 1);
  return <Card><CardHeader><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">{description}</p></div>{secondaryLabel && <StatusBadge tone="gold">{secondaryLabel}</StatusBadge>}</CardHeader><CardContent><div className="flex h-56 items-end gap-3 border-b border-slate-100 pt-4">{data.map((item) => <div className="flex h-full flex-1 items-end gap-1" key={item.label}><div className="w-full rounded-t bg-churchblue transition-colors hover:bg-navy" title={`${item.label}: ${item.value}`} style={{ height: `${Math.max(5, (item.value / max) * 100)}%` }} />{item.secondary != null && <div className="w-full rounded-t bg-gold" title={`${secondaryLabel}: ${item.secondary}`} style={{ height: `${Math.max(5, (item.secondary / max) * 100)}%` }} />}</div>)}</div><div className="mt-3 flex justify-between gap-2 text-[11px] text-slate-400">{data.map((item) => <span key={item.label}>{item.label}</span>)}</div><div className="mt-3 flex gap-4 text-xs text-slate-500"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-churchblue" />{currencyValues ? "Tithe" : "Total"}</span>{secondaryLabel && <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-gold" />{secondaryLabel}</span>}</div></CardContent></Card>;
}

function PrayerSummary({ summary }: { summary: PastorDashboardData["prayerSummary"] }) {
  return <Card><CardHeader><div><h2 className="font-bold text-navy">Prayer Request Summary</h2><p className="mt-1 text-xs text-slate-400">Pastoral care workload and answered testimonies.</p></div><HeartHandshake className="h-5 w-5 text-churchblue" /></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{[["Pending", summary.pending, "gold"], ["Answered", summary.answered, "green"], ["Urgent", summary.urgent, "red"]].map(([label, value, tone]) => <div className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={String(label)}><StatusBadge tone={tone as "gold" | "green" | "red"}>{String(label)}</StatusBadge><p className="mt-4 text-3xl font-bold text-navy">{String(value)}</p></div>)}</CardContent></Card>;
}
