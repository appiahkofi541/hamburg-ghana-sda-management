"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, Clock, Download, FileSpreadsheet, LogIn, LogOut, Pencil, Plus, QrCode, RefreshCw,
  Search, UserCheck, UserPlus, UsersRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles, type AppRole } from "@/lib/auth";
import { required, validEmail } from "@/lib/validation";

type VisitorStatus = "pending" | "contacted" | "scheduled" | "completed" | "not_interested";
type VisitorRecord = {
  id: string;
  visitorNumber: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  occupation: string;
  invitedBy: string;
  visitDate: string;
  notes: string;
  assignedToId: string;
  assignedToName: string;
  followUpStatus: VisitorStatus;
  followUpNotes: string;
  nextFollowUpDate: string;
  convertedMemberId: string;
  convertedAt: string;
  createdAt: string;
};
type AttendanceRecord = {
  id: string;
  visitorId: string;
  visitorName: string;
  visitorNumber: string;
  attendanceDate: string;
  eventName: string;
  eventId: string;
  checkInAt: string;
  checkOutAt: string;
  checkinMethod: string;
  notes: string;
};
type ProfileOption = { id: string; name: string; email: string };
type EventOption = { id: string; title: string; startsAt: string };
type VisitorRow = {
  id: string;
  visitor_number: string;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  invited_by?: string | null;
  visit_date?: string | null;
  notes?: string | null;
  follow_up_assigned_to?: string | null;
  assigned_to?: unknown;
  follow_up_status?: string | null;
  follow_up_notes?: string | null;
  next_follow_up_date?: string | null;
  converted_member_id?: string | null;
  converted_at?: string | null;
  created_at?: string | null;
};

const emptyVisitor: VisitorRecord = {
  id: "",
  visitorNumber: "",
  fullName: "",
  gender: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  address: "",
  occupation: "",
  invitedBy: "",
  visitDate: new Date().toISOString().slice(0, 10),
  notes: "",
  assignedToId: "",
  assignedToName: "",
  followUpStatus: "pending",
  followUpNotes: "",
  nextFollowUpDate: "",
  convertedMemberId: "",
  convertedAt: "",
  createdAt: "",
};
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";
const textAreaClass = "mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-churchblue";
const followUpLabels: Record<VisitorStatus, string> = {
  pending: "Pending",
  contacted: "Contacted",
  scheduled: "Scheduled",
  completed: "Completed",
  not_interested: "Not Interested",
};

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function relatedName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return relatedName(value[0]);
  const row = value as { full_name?: unknown; email?: unknown };
  return String(row.full_name ?? row.email ?? "");
}

function toVisitor(row: VisitorRow): VisitorRecord {
  return {
    id: row.id,
    visitorNumber: row.visitor_number,
    fullName: row.full_name,
    gender: titleCase(row.gender),
    dateOfBirth: row.date_of_birth ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    occupation: row.occupation ?? "",
    invitedBy: row.invited_by ?? "",
    visitDate: row.visit_date ?? "",
    notes: row.notes ?? "",
    assignedToId: row.follow_up_assigned_to ?? "",
    assignedToName: relatedName(row.assigned_to),
    followUpStatus: (row.follow_up_status ?? "pending") as VisitorStatus,
    followUpNotes: row.follow_up_notes ?? "",
    nextFollowUpDate: row.next_follow_up_date ?? "",
    convertedMemberId: row.converted_member_id ?? "",
    convertedAt: row.converted_at ?? "",
    createdAt: row.created_at ?? "",
  };
}

function visitorPayload(form: VisitorRecord, userId?: string) {
  return {
    visitor_number: form.visitorNumber,
    full_name: form.fullName.trim(),
    gender: form.gender.toLowerCase().replaceAll(" ", "_") || null,
    date_of_birth: form.dateOfBirth || null,
    phone: form.phone || null,
    email: form.email || null,
    address: form.address || null,
    occupation: form.occupation || null,
    invited_by: form.invitedBy || null,
    visit_date: form.visitDate || new Date().toISOString().slice(0, 10),
    notes: form.notes || null,
    follow_up_assigned_to: form.assignedToId || null,
    follow_up_status: form.followUpStatus,
    follow_up_notes: form.followUpNotes || null,
    next_follow_up_date: form.nextFollowUpDate || null,
    updated_by: userId || null,
  };
}

function nextVisitorNumber(records: VisitorRecord[]) {
  const year = new Date().getFullYear();
  const max = records.reduce((value, record) => {
    const match = record.visitorNumber.match(/VIS-\d{4}-(\d+)/);
    return Math.max(value, match ? Number(match[1]) : 0);
  }, 0);
  return `VIS-${year}-${String(max + 1).padStart(3, "0")}`;
}

function statusTone(status: VisitorStatus) {
  if (status === "completed") return "green";
  if (status === "not_interested") return "slate";
  if (status === "pending") return "gold";
  return "blue";
}

function qrPattern(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 121 }, (_, index) => ((hash >> (index % 24)) + index + Math.floor(index / 11)) % 3 === 0);
}

function VisitorQr({ visitor }: { visitor: VisitorRecord }) {
  const cells = qrPattern(visitor.visitorNumber || visitor.id);
  return (
    <div className="inline-grid grid-cols-[repeat(11,0.55rem)] gap-0.5 rounded-lg border border-slate-200 bg-white p-3" aria-label={`QR code for ${visitor.visitorNumber}`}>
      {cells.map((filled, index) => <span className={`h-2 w-2 ${filled ? "bg-navy" : "bg-white"}`} key={index} />)}
    </div>
  );
}

export function VisitorManagement() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"visitors" | "attendance" | "followup" | "reports">("visitors");
  const [editing, setEditing] = useState<VisitorRecord | null>(null);
  const [form, setForm] = useState<VisitorRecord>(emptyVisitor);
  const [selectedVisitorId, setSelectedVisitorId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage = roles.some((role) => role === "super_admin" || role === "secretary");
  const canFollowUp = roles.some((role) => ["super_admin", "pastor", "elder", "secretary"].includes(role));

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
      setRoles(normalizeRoles((roleRows ?? []).map(({ role }) => role)));
    }
    const [visitorResult, attendanceResult, profileResult, eventResult] = await Promise.all([
      supabase.from("visitors").select("*, assigned_to:profiles!visitors_follow_up_assigned_to_fkey(full_name, email)").order("visit_date", { ascending: false }),
      supabase.from("visitor_attendance").select("*, visitors(visitor_number, full_name), events(title)").order("attendance_date", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, user_roles(role)").eq("is_active", true).order("full_name"),
      supabase.from("events").select("id, title, starts_at").order("starts_at", { ascending: false }),
    ]);
    if (visitorResult.error) setError(`Unable to load visitors: ${visitorResult.error.message}. Apply the visitor management migration in Supabase.`);
    setVisitors((visitorResult.data ?? []).map(toVisitor));
    setAttendance((attendanceResult.data ?? []).map((row) => ({
      id: row.id,
      visitorId: row.visitor_id,
      visitorName: relatedName(row.visitors),
      visitorNumber: String(Array.isArray(row.visitors) ? row.visitors[0]?.visitor_number ?? "" : row.visitors?.visitor_number ?? ""),
      attendanceDate: row.attendance_date ?? "",
      eventName: row.event_name ?? relatedName(row.events) ?? "Church Visit",
      eventId: row.event_id ?? "",
      checkInAt: row.check_in_at ?? "",
      checkOutAt: row.check_out_at ?? "",
      checkinMethod: titleCase(row.checkin_method ?? "manual"),
      notes: row.notes ?? "",
    })));
    setProfiles((profileResult.data ?? []).filter((profile) => {
      const profileRoles = normalizeRoles(((profile.user_roles ?? []) as { role?: string }[]).map(({ role }) => role));
      return profileRoles.some((role) => role === "pastor" || role === "elder");
    }).map((profile) => ({ id: profile.id, name: profile.full_name ?? profile.email ?? "Church Leader", email: profile.email ?? "" })));
    setEvents((eventResult.data ?? []).map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at })));
    setLoading(false);
  }

  const filteredVisitors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return visitors.filter((visitor) => !normalized || Object.values(visitor).some((value) => String(value).toLowerCase().includes(normalized)));
  }, [query, visitors]);

  const monthPrefix = new Date().toISOString().slice(0, 7);
  const firstTimeVisitorIds = new Set(visitors.filter((visitor) => attendance.filter((row) => row.visitorId === visitor.id).length <= 1).map((visitor) => visitor.id));
  const stats = [
    { label: "Total Visitors", value: visitors.length, icon: UsersRound, tone: "bg-blue-50 text-churchblue" },
    { label: "First-Time Visitors", value: firstTimeVisitorIds.size, icon: UserPlus, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Returning Visitors", value: Math.max(visitors.length - firstTimeVisitorIds.size, 0), icon: RefreshCw, tone: "bg-purple-50 text-purple-700" },
    { label: "Visitors This Month", value: visitors.filter((visitor) => visitor.visitDate.startsWith(monthPrefix)).length, icon: CalendarCheck, tone: "bg-amber-50 text-amber-700" },
    { label: "Visitor-to-Member Conversions", value: visitors.filter((visitor) => visitor.convertedMemberId).length, icon: UserCheck, tone: "bg-cyan-50 text-cyan-700" },
    { label: "Follow-Up Pending", value: visitors.filter((visitor) => visitor.followUpStatus === "pending").length, icon: Clock, tone: "bg-rose-50 text-rose-700" },
  ];

  function openForm(visitor?: VisitorRecord) {
    setEditing(visitor ?? null);
    setForm(visitor ?? { ...emptyVisitor, visitorNumber: nextVisitorNumber(visitors), visitDate: new Date().toISOString().slice(0, 10) });
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyVisitor);
  }

  async function saveVisitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(form.visitorNumber, "Visitor ID") || required(form.fullName, "Full name") || required(form.visitDate, "Visit date") || validEmail(form.email);
    if (validationError) { setError(validationError); return; }
    if (!canManage) { setError("Only Admin/Super Admin or Secretary can manage visitor registration."); return; }
    setSaving(true);
    const supabase = createClient();
    let saved = { ...form, id: editing?.id ?? crypto.randomUUID() };
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = editing ? visitorPayload(form, user?.id) : { ...visitorPayload(form, user?.id), created_by: user?.id ?? null };
      const request = editing
        ? supabase.from("visitors").update(payload).eq("id", editing.id).select("*, assigned_to:profiles!visitors_follow_up_assigned_to_fkey(full_name, email)").single()
        : supabase.from("visitors").insert(payload).select("*, assigned_to:profiles!visitors_follow_up_assigned_to_fkey(full_name, email)").single();
      const { data, error: saveError } = await request;
      if (saveError) { setError(`Unable to save visitor: ${saveError.message}`); setSaving(false); return; }
      saved = toVisitor(data);
    }
    setVisitors((current) => editing ? current.map((visitor) => visitor.id === editing.id ? saved : visitor) : [saved, ...current]);
    setNotice(editing ? "Visitor record updated." : "Visitor registered.");
    setError("");
    setSaving(false);
    closeForm();
  }

  async function checkIn(visitorId = selectedVisitorId, method: "manual" | "qr_code" = "manual") {
    const visitor = visitors.find((item) => item.id === visitorId || item.visitorNumber.toLowerCase() === visitorId.toLowerCase());
    if (!visitor) { setError("Select or scan a valid visitor."); return; }
    if (!canManage) { setError("Only Admin/Super Admin or Secretary can manage visitor attendance."); return; }
    const supabase = createClient();
    const now = new Date().toISOString();
    const selectedEvent = events.find((event) => event.id === selectedEventId);
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: attendanceError } = await supabase.from("visitor_attendance").insert({
        visitor_id: visitor.id,
        event_id: selectedEventId || null,
        event_name: selectedEvent?.title ?? "Church Visit",
        attendance_date: now.slice(0, 10),
        check_in_at: now,
        checkin_method: method,
        recorded_by: user?.id ?? null,
      });
      if (attendanceError) { setError(`Unable to check in visitor: ${attendanceError.message}`); return; }
      await loadData();
    }
    setNotice(`${visitor.fullName} checked in.`);
    setScanCode("");
    setError("");
  }

  async function checkOut(record: AttendanceRecord) {
    if (!canManage) { setError("Only Admin/Super Admin or Secretary can manage visitor attendance."); return; }
    const supabase = createClient();
    if (supabase) {
      const { error: updateError } = await supabase.from("visitor_attendance").update({ check_out_at: new Date().toISOString() }).eq("id", record.id);
      if (updateError) { setError(`Unable to check out visitor: ${updateError.message}`); return; }
      await loadData();
    }
    setNotice(`${record.visitorName} checked out.`);
  }

  async function saveFollowUp(visitor: VisitorRecord) {
    if (!canFollowUp) { setError("Only Pastor, Elder, Secretary, or Admin can update follow-up."); return; }
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase.from("visitors").update({
        follow_up_assigned_to: visitor.assignedToId || null,
        follow_up_status: visitor.followUpStatus,
        follow_up_notes: visitor.followUpNotes || null,
        next_follow_up_date: visitor.nextFollowUpDate || null,
        updated_by: user?.id ?? null,
      }).eq("id", visitor.id);
      if (updateError) { setError(`Unable to update follow-up: ${updateError.message}`); return; }
    }
    setVisitors((current) => current.map((item) => item.id === visitor.id ? visitor : item));
    setNotice("Follow-up updated.");
    setError("");
  }

  async function convertVisitor(visitor: VisitorRecord) {
    if (!canManage) { setError("Only Admin/Super Admin or Secretary can convert visitors to members."); return; }
    if (visitor.convertedMemberId) return;
    const [firstName, ...lastParts] = visitor.fullName.trim().split(/\s+/);
    const supabase = createClient();
    if (supabase) {
      const memberNumber = `HG-${String(Date.now()).slice(-6)}`;
      const { data: member, error: memberError } = await supabase.from("members").insert({
        member_number: memberNumber,
        first_name: firstName || visitor.fullName,
        last_name: lastParts.join(" ") || "Visitor",
        full_name: visitor.fullName,
        gender: visitor.gender.toLowerCase().replaceAll(" ", "_") || null,
        date_of_birth: visitor.dateOfBirth || null,
        phone: visitor.phone || null,
        email: visitor.email || null,
        address_line: visitor.address || null,
        occupation: visitor.occupation || null,
        status: "active",
        joined_on: new Date().toISOString().slice(0, 10),
      }).select("id").single();
      if (memberError) { setError(`Unable to create member record: ${memberError.message}`); return; }
      const { error: visitorError } = await supabase.from("visitors").update({ converted_member_id: member.id, converted_at: new Date().toISOString(), follow_up_status: "completed" }).eq("id", visitor.id);
      if (visitorError) { setError(`Member created, but visitor conversion could not be linked: ${visitorError.message}`); return; }
      await loadData();
    }
    setNotice(`${visitor.fullName} converted to a member. Attendance history remains linked to the visitor record.`);
    setError("");
  }

  function exportExcel() {
    const headers = ["Visitor ID", "Name", "Gender", "Visit Date", "Phone", "Email", "Invited By", "Follow-up", "Assigned To", "Next Follow-up", "Converted"];
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const rows = filteredVisitors.map((visitor) => row([visitor.visitorNumber, visitor.fullName, visitor.gender, visitor.visitDate, visitor.phone, visitor.email, visitor.invitedBy, followUpLabels[visitor.followUpStatus], visitor.assignedToName, visitor.nextFollowUpDate, visitor.convertedMemberId ? "Yes" : "No"]));
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Visitors"><Table>${row(headers)}${rows.join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Hamburg-Ghana-SDA-Visitors.xls";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church - Visitor Report", 14, 16);
    document.setFontSize(9);
    document.text(`Visitors: ${filteredVisitors.length} | Attendance records: ${attendance.length} | Conversions: ${stats[4].value}`, 14, 23);
    autoTableModule.default(document, {
      startY: 29,
      head: [["Visitor ID", "Name", "Visit Date", "Phone", "Invited By", "Follow-up", "Assigned", "Converted"]],
      body: filteredVisitors.map((visitor) => [visitor.visitorNumber, visitor.fullName, visitor.visitDate, visitor.phone, visitor.invitedBy, followUpLabels[visitor.followUpStatus], visitor.assignedToName || "-", visitor.convertedMemberId ? "Yes" : "No"]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save("Hamburg-Ghana-SDA-Visitors.pdf");
  }

  const reportRows = [
    ["Daily Visitors", visitors.filter((visitor) => visitor.visitDate === new Date().toISOString().slice(0, 10)).length],
    ["Weekly Visitors", visitors.filter((visitor) => Date.now() - new Date(visitor.visitDate).getTime() <= 7 * 86400000).length],
    ["Monthly Visitors", visitors.filter((visitor) => visitor.visitDate.startsWith(monthPrefix)).length],
    ["Visitor Attendance Report", attendance.length],
    ["Conversion Report", visitors.filter((visitor) => visitor.convertedMemberId).length],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <PageHeading title="Visitor Management" description="Register visitors, record attendance, manage follow-up, QR check-ins, conversions, and visitor reports." />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> Export PDF</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
          {canManage && <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Register Visitor</Button>}
        </div>
      </div>
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card className="p-4" key={label}>
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-100 bg-white p-2 shadow-card">
        {[
          ["visitors", "Visitor Registration"],
          ["attendance", "Visitor Attendance"],
          ["followup", "Follow-Up Management"],
          ["reports", "Reports"],
        ].map(([tab, label]) => <Button key={tab} variant={activeTab === tab ? "default" : "ghost"} onClick={() => setActiveTab(tab as typeof activeTab)}>{label}</Button>)}
      </div>

      {activeTab === "visitors" && (
        <Card>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 md:flex-row">
            <label className="flex h-10 max-w-lg flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search visitors by name, phone, invited by, or status..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Visitor", "Contact", "Visit", "Follow-up", "QR Code", "Conversion", "Actions"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {loading && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={7}>Loading visitors...</td></tr>}
                {filteredVisitors.map((visitor) => (
                  <tr className="border-t border-slate-100" key={visitor.id}>
                    <td className="px-5 py-4"><p className="font-bold text-navy">{visitor.fullName}</p><p className="mt-1 text-xs text-slate-400">{visitor.visitorNumber} · {visitor.gender || "Gender not set"}</p></td>
                    <td className="px-5 py-4 text-slate-600"><p>{visitor.phone || "-"}</p><p className="mt-1 text-xs text-slate-400">{visitor.email || "No email"}</p></td>
                    <td className="px-5 py-4 text-slate-600"><p>{visitor.visitDate}</p><p className="mt-1 text-xs text-slate-400">Invited by {visitor.invitedBy || "not recorded"}</p></td>
                    <td className="px-5 py-4"><StatusBadge tone={statusTone(visitor.followUpStatus)}>{followUpLabels[visitor.followUpStatus]}</StatusBadge><p className="mt-1 text-xs text-slate-400">{visitor.assignedToName || "Unassigned"}</p></td>
                    <td className="px-5 py-4"><VisitorQr visitor={visitor} /></td>
                    <td className="px-5 py-4"><StatusBadge tone={visitor.convertedMemberId ? "green" : "slate"}>{visitor.convertedMemberId ? "Converted" : "Visitor"}</StatusBadge></td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{canManage && <Button size="sm" variant="ghost" onClick={() => openForm(visitor)}><Pencil className="h-4 w-4" /> Edit</Button>}{canManage && <Button size="sm" variant="ghost" disabled={Boolean(visitor.convertedMemberId)} onClick={() => convertVisitor(visitor)}><UserCheck className="h-4 w-4" /> Convert</Button>}</div></td>
                  </tr>
                ))}
                {!loading && filteredVisitors.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={7}>No visitors found.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "attendance" && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
          <Card className="p-5">
            <h2 className="font-bold text-navy">Check-In / QR Scan</h2>
            <div className="mt-4 space-y-4">
              <label className="text-sm font-semibold text-slate-700">Visitor<select className={fieldClass} value={selectedVisitorId} onChange={(event) => setSelectedVisitorId(event.target.value)}><option value="">Select visitor</option>{visitors.map((visitor) => <option key={visitor.id} value={visitor.id}>{visitor.fullName} ({visitor.visitorNumber})</option>)}</select></label>
              <label className="text-sm font-semibold text-slate-700">Event Attendance<select className={fieldClass} value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}><option value="">Church Visit</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
              <Button className="w-full" disabled={!canManage} onClick={() => checkIn()}><LogIn className="h-4 w-4" /> Check In</Button>
              <div className="border-t border-slate-100 pt-4">
                <label className="text-sm font-semibold text-slate-700">Scan QR / Visitor ID<input className={fieldClass} placeholder="VIS-2026-001" value={scanCode} onChange={(event) => setScanCode(event.target.value)} /></label>
                <Button className="mt-3 w-full" variant="outline" disabled={!canManage || !scanCode.trim()} onClick={() => checkIn(scanCode.trim(), "qr_code")}><QrCode className="h-4 w-4" /> Scan QR Check-In</Button>
              </div>
            </div>
          </Card>
          <Card>
            <div className="border-b border-slate-100 p-4"><h2 className="font-bold text-navy">Attendance History</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Visitor", "Date", "Event", "Check-in", "Check-out", "Actions"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead>
                <tbody>
                  {attendance.map((row) => <tr className="border-t border-slate-100" key={row.id}><td className="px-5 py-4"><p className="font-semibold text-navy">{row.visitorName}</p><p className="text-xs text-slate-400">{row.visitorNumber}</p></td><td className="px-5 py-4 text-slate-600">{row.attendanceDate}</td><td className="px-5 py-4 text-slate-600">{row.eventName}</td><td className="px-5 py-4"><StatusBadge tone={row.checkinMethod === "Qr Code" ? "blue" : "slate"}>{row.checkinMethod}</StatusBadge><p className="mt-1 text-xs text-slate-400">{row.checkInAt ? row.checkInAt.slice(0, 16).replace("T", " ") : "-"}</p></td><td className="px-5 py-4 text-slate-600">{row.checkOutAt ? row.checkOutAt.slice(0, 16).replace("T", " ") : "-"}</td><td className="px-5 py-4"><Button size="sm" variant="outline" disabled={!canManage || Boolean(row.checkOutAt)} onClick={() => checkOut(row)}><LogOut className="h-4 w-4" /> Check Out</Button></td></tr>)}
                  {attendance.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={6}>No visitor attendance yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "followup" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredVisitors.map((visitor) => (
            <Card className="p-5" key={visitor.id}>
              <div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-navy">{visitor.fullName}</h2><p className="mt-1 text-xs text-slate-400">{visitor.visitorNumber} · Next follow-up {visitor.nextFollowUpDate || "not scheduled"}</p></div><StatusBadge tone={statusTone(visitor.followUpStatus)}>{followUpLabels[visitor.followUpStatus]}</StatusBadge></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Assigned Elder/Pastor<select className={fieldClass} value={visitor.assignedToId} onChange={(event) => setVisitors((current) => current.map((item) => item.id === visitor.id ? { ...item, assignedToId: event.target.value, assignedToName: profiles.find((profile) => profile.id === event.target.value)?.name ?? "" } : item))}><option value="">Unassigned</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                <label className="text-sm font-semibold text-slate-700">Follow-up Status<select className={fieldClass} value={visitor.followUpStatus} onChange={(event) => setVisitors((current) => current.map((item) => item.id === visitor.id ? { ...item, followUpStatus: event.target.value as VisitorStatus } : item))}>{Object.entries(followUpLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Next Follow-up Date<input className={fieldClass} type="date" value={visitor.nextFollowUpDate} onChange={(event) => setVisitors((current) => current.map((item) => item.id === visitor.id ? { ...item, nextFollowUpDate: event.target.value } : item))} /></label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Follow-up Notes<textarea className={textAreaClass} value={visitor.followUpNotes} onChange={(event) => setVisitors((current) => current.map((item) => item.id === visitor.id ? { ...item, followUpNotes: event.target.value } : item))} /></label>
              </div>
              <div className="mt-4 flex justify-end"><Button disabled={!canFollowUp} onClick={() => saveFollowUp(visitor)}>Save Follow-up</Button></div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "reports" && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {reportRows.map(([label, value]) => <Card className="p-5" key={label}><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-navy">{value}</p></Card>)}
        </section>
      )}

      {form.visitorNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={saveVisitor}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 className="font-bold text-navy">{editing ? "Edit Visitor" : "Register Visitor"}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church visitor record</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close visitor form" onClick={closeForm}><X className="h-5 w-5" /></Button></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {[["Visitor ID", "visitorNumber", "text"], ["Full Name", "fullName", "text"], ["Date of Birth", "dateOfBirth", "date"], ["Phone Number", "phone", "tel"], ["Email", "email", "email"], ["Occupation", "occupation", "text"], ["Invited By", "invitedBy", "text"], ["Visit Date", "visitDate", "date"], ["Next Follow-up Date", "nextFollowUpDate", "date"]].map(([label, key, type]) => <label className="text-sm font-semibold text-slate-700" key={key}>{label}<input className={fieldClass} type={type} value={String(form[key as keyof VisitorRecord])} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={["visitorNumber", "fullName", "visitDate"].includes(key)} /></label>)}
              <label className="text-sm font-semibold text-slate-700">Gender<select className={fieldClass} value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>{["", "Male", "Female", "Other", "Prefer Not To Say"].map((option) => <option key={option} value={option}>{option || "Select option"}</option>)}</select></label>
              <label className="text-sm font-semibold text-slate-700">Assigned Elder/Pastor<select className={fieldClass} value={form.assignedToId} onChange={(event) => setForm({ ...form, assignedToId: event.target.value })}><option value="">Unassigned</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <label className="text-sm font-semibold text-slate-700">Follow-up Status<select className={fieldClass} value={form.followUpStatus} onChange={(event) => setForm({ ...form, followUpStatus: event.target.value as VisitorStatus })}>{Object.entries(followUpLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Address<input className={fieldClass} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Notes<textarea className={textAreaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Follow-up Notes<textarea className={textAreaClass} value={form.followUpNotes} onChange={(event) => setForm({ ...form, followUpNotes: event.target.value })} /></label>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button disabled={saving || !canManage} type="submit">{saving ? "Saving..." : "Save Visitor"}</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}
