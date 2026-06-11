"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Download, FileSpreadsheet, Search, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles } from "@/lib/auth";

type EventOption = { id: string; title: string; startsAt: string; location: string };
type RegistrationRow = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  memberPhoto: string;
  registrationDate: string;
  status: string;
  present: boolean;
  checkedBy: string;
  checkinMethod: string;
  checkedInAt: string;
};

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function relatedName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return relatedName(value[0]);
  const row = value as { title?: unknown; full_name?: unknown; first_name?: unknown; last_name?: unknown };
  return String(row.title ?? row.full_name ?? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() ?? "");
}

function relatedDate(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return relatedDate(value[0]);
  return String((value as { starts_at?: unknown }).starts_at ?? "");
}

function memberNumber(value: unknown, fallback: string) {
  if (!value) return fallback.slice(0, 8).toUpperCase();
  const row = Array.isArray(value) ? value[0] as { member_number?: unknown } | undefined : value as { member_number?: unknown };
  return String(row?.member_number ?? fallback.slice(0, 8).toUpperCase());
}

function memberPhoto(value: unknown) {
  if (!value) return "";
  const row = Array.isArray(value) ? value[0] as { photo_thumbnail_url?: unknown; photo_url?: unknown } | undefined : value as { photo_thumbnail_url?: unknown; photo_url?: unknown };
  return String(row?.photo_thumbnail_url ?? row?.photo_url ?? "");
}

function statusTone(status: string) {
  if (status === "Attended") return "green";
  if (status === "Cancelled") return "slate";
  return "gold";
}

export function EventRegistrationAttendance({ initialMode = "registrations" }: { initialMode?: "registrations" | "attendance" }) {
  const [mode, setMode] = useState(initialMode);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [canManage, setCanManage] = useState(!createClient());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
      setCanManage(roles.some((role) => role === "super_admin" || role === "secretary"));
    }

    const [eventResult, registrationResult, attendanceResult] = await Promise.all([
      supabase.from("events").select("id, title, starts_at, location").order("starts_at", { ascending: false }),
      supabase
        .from("event_registrations")
        .select("id, event_id, member_id, registration_status, status, registration_date, created_at, events(title, starts_at), members(full_name, first_name, last_name, member_number, photo_thumbnail_url, photo_url)")
        .order("created_at", { ascending: false }),
      supabase.from("event_attendance").select("id, event_id, member_id, present, checked_by, created_at, checked_in_at, checkin_method, checker:profiles!event_attendance_checked_by_fkey(full_name)"),
    ]);

    if (eventResult.error) setError(`Unable to load events: ${eventResult.error.message}`);
    if (registrationResult.error) setError(`Unable to load event registrations: ${registrationResult.error.message}`);
    if (attendanceResult.error) setError(`Unable to load event attendance: ${attendanceResult.error.message}. Apply the event attendance migration in Supabase.`);

    setEvents((eventResult.data ?? []).map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at, location: event.location ?? "" })));
    const attendanceByEventMember = new Map((attendanceResult.data ?? []).map((attendance) => [`${attendance.event_id}:${attendance.member_id}`, attendance]));
    setRows((registrationResult.data ?? []).map((registration) => {
      const key = `${registration.event_id}:${registration.member_id}`;
      const attendance = attendanceByEventMember.get(key);
      return {
        id: registration.id,
        eventId: registration.event_id,
        eventTitle: relatedName(registration.events) || "Church Event",
        eventDate: relatedDate(registration.events),
        memberId: registration.member_id,
        memberName: relatedName(registration.members) || "Member",
        memberNumber: memberNumber(registration.members, registration.member_id),
        memberPhoto: memberPhoto(registration.members),
        registrationDate: registration.registration_date ?? registration.created_at,
        status: titleCase(registration.status ?? registration.registration_status ?? "registered"),
        present: Boolean(attendance?.present),
        checkedBy: relatedName(attendance?.checker) || "",
        checkinMethod: titleCase(attendance?.checkin_method ?? "manual"),
        checkedInAt: String(attendance?.checked_in_at ?? attendance?.created_at ?? ""),
      };
    }));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) =>
      (selectedEventId === "all" || row.eventId === selectedEventId)
      && (!normalized || Object.values(row).some((value) => String(value).toLowerCase().includes(normalized)))
    );
  }, [query, rows, selectedEventId]);

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const totalRegistered = filtered.filter((row) => row.status !== "Cancelled").length;
  const totalPresent = filtered.filter((row) => row.present || row.status === "Attended").length;
  const attendanceRate = totalRegistered ? Math.round((totalPresent / totalRegistered) * 100) : 0;

  async function markAttendance(row: RegistrationRow, present: boolean) {
    if (!canManage) {
      setError("Only Super Admin/Admin or Secretary can mark event attendance.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setProcessingId(row.id);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: attendanceError } = await supabase.from("event_attendance").upsert({
      event_id: row.eventId,
      member_id: row.memberId,
      present,
      checked_by: user?.id ?? null,
      checkin_method: "manual",
      checked_in_at: present ? new Date().toISOString() : null,
    }, { onConflict: "event_id,member_id" });
    if (attendanceError) {
      setError(`Unable to save event attendance: ${attendanceError.message}`);
      setProcessingId("");
      return;
    }
    const { error: registrationError } = await supabase
      .from("event_registrations")
      .update({ registration_status: present ? "attended" : "registered", status: present ? "attended" : "registered", attendance_confirmed: present, confirmed_at: present ? new Date().toISOString() : null })
      .eq("id", row.id);
    if (registrationError) setError(`Attendance saved, but registration status update failed: ${registrationError.message}`);
    else setNotice(present ? `${row.memberName} marked present.` : `${row.memberName} marked not present.`);
    await loadData();
    setProcessingId("");
  }

  function exportExcel() {
    const headers = ["Event", "Event Date", "Member", "Member Number", "Registration Date", "Status", "Present", "Check-in Method", "Checked In At", "Checked By"];
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const body = filtered.map((item) => row([item.eventTitle, item.eventDate.slice(0, 16).replace("T", " "), item.memberName, item.memberNumber, item.registrationDate.slice(0, 10), item.status, item.present ? "Yes" : "No", item.checkinMethod, item.checkedInAt ? item.checkedInAt.slice(0, 16).replace("T", " ") : "-", item.checkedBy || "-"]));
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Event Attendance"><Table>${row(headers)}${body.join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hamburg-Ghana-SDA-Event-${mode}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church", 14, 14);
    document.setFontSize(10);
    document.text(`${mode === "attendance" ? "Event Attendance" : "Event Registrations"} Report | ${selectedEvent?.title ?? "All Events"}`, 14, 21);
    autoTableModule.default(document, {
      startY: 28,
      head: [["Event", "Date", "Member", "Member No.", "Registered", "Status", "Present", "Method", "Checked In", "Checked By"]],
      body: filtered.map((item) => [item.eventTitle, item.eventDate.slice(0, 16).replace("T", " "), item.memberName, item.memberNumber, item.registrationDate.slice(0, 10), item.status, item.present ? "Yes" : "No", item.checkinMethod, item.checkedInAt ? item.checkedInAt.slice(0, 16).replace("T", " ") : "-", item.checkedBy || "-"]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save(`Hamburg-Ghana-SDA-Event-${mode}.pdf`);
  }

  return (
    <div className="space-y-6">
      <PageHeading title={mode === "attendance" ? "Event Attendance" : "Event Registrations"} description="Manage event registrations, check attendance, and export event reports." />
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-100 bg-white p-2 shadow-card">
        <Link href="/event-registrations"><Button type="button" variant={mode === "registrations" ? "default" : "ghost"} onClick={() => setMode("registrations")}>Registrations</Button></Link>
        <Link href="/event-attendance"><Button type="button" variant={mode === "attendance" ? "default" : "ghost"} onClick={() => setMode("attendance")}>Attendance</Button></Link>
        <Link href="/events"><Button type="button" variant="outline">Back to Events</Button></Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><UsersRound className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">Registered</p><p className="mt-1 text-2xl font-bold text-navy">{totalRegistered}</p></div></Card>
        <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">Present</p><p className="mt-1 text-2xl font-bold text-navy">{totalPresent}</p></div></Card>
        <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-amber-50 p-3 text-amber-700"><CalendarCheck className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">Attendance Rate</p><p className="mt-1 text-2xl font-bold text-navy">{attendanceRate}%</p></div></Card>
      </section>

      <Card>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center">
          <label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search registrations..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <select className={fieldClass} value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}><option value="all">All Events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
            <Button type="button" variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> Export PDF</Button>
            <Button type="button" variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
          </div>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading event records...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Event", "Member", "Registered", "Status", "Present", "Check-in", "Checked By", "Actions"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {filtered.map((row) => <tr className="border-t border-slate-100" key={row.id}><td className="px-5 py-4"><p className="font-bold text-navy">{row.eventTitle}</p><p className="mt-1 text-xs text-slate-400">{row.eventDate.slice(0, 16).replace("T", " ")}</p></td><td className="px-5 py-4"><div className="flex items-center gap-3"><MemberAvatar alt={row.memberName} size="sm" src={row.memberPhoto} /><div><p className="font-semibold text-navy">{row.memberName}</p><p className="text-xs text-slate-400">{row.memberNumber}</p></div></div></td><td className="px-5 py-4 text-slate-600">{row.registrationDate.slice(0, 10)}</td><td className="px-5 py-4"><StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge></td><td className="px-5 py-4"><StatusBadge tone={row.present || row.status === "Attended" ? "green" : "slate"}>{row.present || row.status === "Attended" ? "Present" : "Not marked"}</StatusBadge></td><td className="px-5 py-4"><StatusBadge tone={row.checkinMethod === "Qr Code" ? "blue" : "slate"}>{row.checkinMethod}</StatusBadge><p className="mt-1 text-xs text-slate-400">{row.checkedInAt ? row.checkedInAt.slice(0, 16).replace("T", " ") : "-"}</p></td><td className="px-5 py-4 text-slate-600">{row.checkedBy || "-"}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-1"><Button type="button" size="sm" disabled={!canManage || processingId === row.id} onClick={() => markAttendance(row, true)}>Mark Present</Button><Button type="button" size="sm" variant="outline" disabled={!canManage || processingId === row.id} onClick={() => markAttendance(row, false)}>Clear</Button></div></td></tr>)}
                {filtered.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={8}>No event records found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
