"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardCheck, Download, FileSpreadsheet, Pencil, Plus, Search, Trash2, UserRoundPlus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles } from "@/lib/auth";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { MemberAvatar } from "@/components/member-avatar";
import { StatusBadge } from "@/components/status-badge";

type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused";
type CategoryOption = { id: string; name: string; slug: string; isActive: boolean };
type MemberOption = { id: string; name: string; memberNumber: string; photo: string; department: string };
type DepartmentOption = { id: string; name: string; isActive: boolean };
type AttendanceRecord = {
  id: string;
  sessionId: string;
  date: string;
  categoryId: string;
  categoryName: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  visitorName: string;
  departmentId: string;
  departmentName: string;
  status: AttendanceStatus;
  notes: string;
  recordedBy: string;
  checkedInAt: string;
};
type AttendanceForm = {
  date: string;
  categoryId: string;
  memberId: string;
  visitorName: string;
  departmentId: string;
  status: AttendanceStatus;
  notes: string;
};

const statuses: AttendanceStatus[] = ["Present", "Absent", "Late", "Excused"];
const defaultCategories: CategoryOption[] = [
  { id: "sabbath-worship", name: "Sabbath Worship", slug: "sabbath-worship", isActive: true },
  { id: "sabbath-school", name: "Sabbath School", slug: "sabbath-school", isActive: true },
  { id: "prayer-meeting", name: "Prayer Meeting", slug: "prayer-meeting", isActive: true },
  { id: "youth-meeting", name: "Youth Meeting", slug: "youth-meeting", isActive: true },
  { id: "department-meeting", name: "Department Meeting", slug: "department-meeting", isActive: true },
  { id: "visitors", name: "Visitors", slug: "visitors", isActive: true },
];
const emptyForm: AttendanceForm = { date: new Date().toISOString().slice(0, 10), categoryId: "", memberId: "", visitorName: "", departmentId: "", status: "Present", notes: "" };
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function enumize(value: string) {
  return value.toLowerCase().replaceAll(" ", "_");
}

function serviceTypeFor(categoryName: string) {
  const normalized = categoryName.toLowerCase();
  if (normalized.includes("school")) return "sabbath_school";
  if (normalized.includes("prayer")) return "midweek_prayer_meeting";
  if (normalized.includes("youth")) return "youth_program";
  if (normalized.includes("department")) return "special_event";
  if (normalized.includes("visitor")) return "special_event";
  return "divine_service";
}

function relatedName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return relatedName(value[0]);
  const row = value as { name?: unknown; full_name?: unknown; member_id?: unknown };
  return String(row.name ?? row.full_name ?? row.member_id ?? "");
}

function memberNumber(member: { member_id?: string | null; member_number?: string | null; id: string }) {
  return member.member_id || member.member_number || member.id.slice(0, 8).toUpperCase();
}

function rowDate(row: AttendanceRecord) {
  return row.date.slice(0, 7);
}

function isPresentStatus(status: AttendanceStatus) {
  return status === "Present" || status === "Late";
}

function statusTone(status: AttendanceStatus) {
  if (status === "Present") return "green";
  if (status === "Late") return "gold";
  if (status === "Excused") return "blue";
  return "slate";
}

export function AttendanceManagement() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>(defaultCategories);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedDepartment, setSelectedDepartment] = useState("All Departments");
  const [form, setForm] = useState<AttendanceForm>({ ...emptyForm });
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(!createClient());

  useEffect(() => {
    loadAttendance();
  }, []);

  async function loadAttendance() {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
      setCanManage(roles.some((role) => ["super_admin", "pastor", "elder", "secretary", "church_clerk", "department_head"].includes(role)));
    }

    const [categoryResult, memberResult, departmentResult, entryResult] = await Promise.all([
      supabase.from("attendance_categories").select("*").order("sort_order").order("name"),
      supabase.from("members").select("id, member_id, member_number, full_name, first_name, last_name, photo_thumbnail_url, photo_url, department_members(departments(name))").eq("status", "active").order("last_name"),
      supabase.from("departments").select("id, name, is_active").order("name"),
      supabase
        .from("attendance_entries")
        .select("id, session_id, member_id, visitor_name, status, notes, checked_in_at, department_id, recorded_by, attendance_sessions(id, service_name, service_date, attendance_category_id, department_id), members(id, member_id, member_number, full_name), departments(id, name), recorded_by_profile:profiles!attendance_entries_recorded_by_fkey(full_name)")
        .order("checked_in_at", { ascending: false }),
    ]);

    if (categoryResult.error) {
      setError(`Attendance categories are not ready yet: ${categoryResult.error.message}. Apply migration 202606090007_attendance_module.sql in Supabase.`);
    } else if (categoryResult.data?.length) {
      setCategories(categoryResult.data.map((row) => ({ id: row.id, name: row.name, slug: row.slug, isActive: Boolean(row.is_active) })));
    }

    setMembers((memberResult.data ?? []).map((member) => {
      const name = member.full_name || `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "Unnamed Member";
      return {
        id: member.id,
        name,
        memberNumber: memberNumber(member),
        photo: member.photo_thumbnail_url ?? member.photo_url ?? "",
        department: relatedName((member.department_members as unknown[] | null)?.[0] ? (member.department_members as unknown[])[0] : null) || "Member",
      };
    }));
    setDepartments((departmentResult.data ?? []).map((department) => ({ id: department.id, name: department.name, isActive: Boolean(department.is_active) })));

    if (entryResult.error) {
      setError((current) => current || `Unable to load attendance records: ${entryResult.error.message}`);
      setRecords([]);
    } else {
      setRecords((entryResult.data ?? []).map((row) => {
        const session = Array.isArray(row.attendance_sessions) ? row.attendance_sessions[0] : row.attendance_sessions;
        const member = Array.isArray(row.members) ? row.members[0] : row.members;
        const department = Array.isArray(row.departments) ? row.departments[0] : row.departments;
        const recorder = Array.isArray(row.recorded_by_profile) ? row.recorded_by_profile[0] : row.recorded_by_profile;
        const category = (categoryResult.data ?? []).find((item) => item.id === session?.attendance_category_id);
        return {
          id: row.id,
          sessionId: row.session_id,
          date: session?.service_date ?? row.checked_in_at.slice(0, 10),
          categoryId: session?.attendance_category_id ?? "",
          categoryName: category?.name ?? session?.service_name ?? "Attendance",
          memberId: row.member_id ?? "",
          memberName: member?.full_name ?? "",
          memberNumber: member ? memberNumber(member) : "",
          visitorName: row.visitor_name ?? "",
          departmentId: row.department_id ?? session?.department_id ?? "",
          departmentName: department?.name ?? "",
          status: titleCase(row.status) as AttendanceStatus,
          notes: row.notes ?? "",
          recordedBy: recorder?.full_name ?? "Church Leader",
          checkedInAt: row.checked_in_at,
        };
      }));
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) =>
      (!selectedMonth || rowDate(record) === selectedMonth)
      && (selectedCategory === "All Categories" || record.categoryName === selectedCategory)
      && (selectedDepartment === "All Departments" || record.departmentName === selectedDepartment)
      && (!normalized || Object.values(record).some((value) => String(value).toLowerCase().includes(normalized)))
    );
  }, [query, records, selectedCategory, selectedDepartment, selectedMonth]);

  const monthRecords = records.filter((record) => rowDate(record) === selectedMonth);
  const totalAttendanceThisMonth = monthRecords.filter((record) => isPresentStatus(record.status)).length;
  const sabbathRecords = monthRecords.filter((record) => record.categoryName.toLowerCase().includes("sabbath") && isPresentStatus(record.status));
  const sabbathDates = new Set(sabbathRecords.map((record) => record.date));
  const sabbathAverage = sabbathDates.size ? Math.round(sabbathRecords.length / sabbathDates.size) : 0;
  const visitorCount = monthRecords.filter((record) => record.visitorName).length;
  const departmentTotals = [...monthRecords.reduce<Map<string, number>>((acc, record) => {
    if (record.departmentName && isPresentStatus(record.status)) acc.set(record.departmentName, (acc.get(record.departmentName) ?? 0) + 1);
    return acc;
  }, new Map()).entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);
  const memberHistory = [...filtered.reduce<Map<string, number>>((acc, record) => {
    const label = record.memberName || record.visitorName || "Visitor";
    acc.set(label, (acc.get(label) ?? 0) + (isPresentStatus(record.status) ? 1 : 0));
    return acc;
  }, new Map()).entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);

  function openForm(record?: AttendanceRecord) {
    if (!canManage) {
      setError("Only Admin, Pastor, Elder, Secretary, Church Clerk, or Department Head can record attendance.");
      return;
    }
    setEditing(record ?? null);
    setForm(record ? {
      date: record.date,
      categoryId: record.categoryId,
      memberId: record.memberId,
      visitorName: record.visitorName,
      departmentId: record.departmentId,
      status: record.status,
      notes: record.notes,
    } : { ...emptyForm, categoryId: categories.find((category) => category.isActive)?.id ?? "" });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories.find((category) => category.isActive)?.id ?? "" });
    setShowForm(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const selected = categories.find((category) => category.id === form.categoryId);
    const validationError = required(form.date, "Date") || required(form.categoryId, "Service/Event type");
    if (validationError) { setError(validationError); return; }
    if (!form.memberId && !form.visitorName.trim()) { setError("Select a member or enter a visitor name."); return; }
    if (form.memberId && form.visitorName.trim()) { setError("Use either a member or a visitor name, not both."); return; }
    if (!selected) { setError("Select a valid attendance category."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const sessionPayload = {
        service_name: selected.name,
        service_type: serviceTypeFor(selected.name),
        service_date: form.date,
        attendance_category_id: selected.id,
        department_id: form.departmentId || null,
        recorded_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      };
      const { data: session, error: sessionError } = await supabase
        .from("attendance_sessions")
        .upsert(sessionPayload, { onConflict: "service_name,service_date" })
        .select("id")
        .single();
      if (sessionError || !session?.id) {
        setError(sessionError?.message || "Unable to create attendance session.");
        setSaving(false);
        return;
      }
      const entryPayload = {
        session_id: session.id,
        member_id: form.memberId || null,
        visitor_name: form.visitorName.trim() || null,
        status: enumize(form.status),
        department_id: form.departmentId || null,
        notes: form.notes || null,
        recorded_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      };
      const request = editing
        ? supabase.from("attendance_entries").update(entryPayload).eq("id", editing.id)
        : supabase.from("attendance_entries").insert(entryPayload);
      const { error: saveError } = await request;
      if (saveError) {
        setError(saveError.message);
        setSaving(false);
        return;
      }
      await loadAttendance();
    }
    setNotice(editing ? "Attendance record updated." : "Attendance recorded.");
    setSaving(false);
    closeForm();
  }

  async function remove(record: AttendanceRecord) {
    if (!canManage) return;
    if (!window.confirm(`Delete attendance for ${record.memberName || record.visitorName} on ${record.date}?`)) return;
    const supabase = createClient();
    if (supabase) {
      const { error: deleteError } = await supabase.from("attendance_entries").delete().eq("id", record.id);
      if (deleteError) { setError(deleteError.message); return; }
      await loadAttendance();
    } else {
      setRecords((current) => current.filter(({ id }) => id !== record.id));
    }
    setNotice("Attendance record deleted.");
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church", 14, 14);
    document.setFontSize(10);
    document.text(`Attendance Report | Month: ${selectedMonth} | Category: ${selectedCategory} | Department: ${selectedDepartment}`, 14, 21);
    autoTableModule.default(document, {
      startY: 28,
      head: [["Date", "Service/Event", "Member/Visitor", "Department", "Status", "Recorded By", "Notes"]],
      body: filtered.map((record) => [record.date, record.categoryName, record.memberName || record.visitorName, record.departmentName || "-", record.status, record.recordedBy, record.notes]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save(`Hamburg-Ghana-SDA-Attendance-${selectedMonth}.pdf`);
  }

  function exportExcel() {
    const headers = ["Date", "Service/Event", "Member ID", "Member/Visitor", "Department", "Status", "Recorded By", "Notes"];
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const rows = filtered.map((record) => row([record.date, record.categoryName, record.memberNumber, record.memberName || record.visitorName, record.departmentName || "-", record.status, record.recordedBy, record.notes]));
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Attendance"><Table>${row(headers)}${rows.join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hamburg-Ghana-SDA-Attendance-${selectedMonth}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeading title="Attendance" description="Track member, visitor, Sabbath, prayer meeting, youth, and department attendance." />
      {notice && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-churchblue">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total attendance this month", value: totalAttendanceThisMonth, icon: ClipboardCheck },
          { label: "Sabbath average", value: sabbathAverage, icon: BarChart3 },
          { label: "Visitor count", value: visitorCount, icon: UserRoundPlus },
          { label: "Department attendance", value: departmentTotals.reduce((sum, [, count]) => sum + count, 0), icon: Users },
        ].map(({ label, value, icon: Icon }) => <Card className="flex items-center gap-4 p-5" key={label}><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{value}</p></div></Card>)}
      </section>

      <Card>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center">
          <label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search attendance..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <input className={fieldClass} type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
            <select className={fieldClass} value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option>All Categories</option>{categories.map((category) => <option key={category.id}>{category.name}</option>)}</select>
            <select className={fieldClass} value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}><option>All Departments</option>{departments.map((department) => <option key={department.id}>{department.name}</option>)}</select>
            <Button type="button" variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> Export PDF</Button>
            <Button type="button" variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
            <Button type="button" disabled={!canManage} title={canManage ? "Record attendance" : "Access denied"} onClick={() => openForm()}><Plus className="h-4 w-4" /> Record Attendance</Button>
          </div>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading attendance...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Date", "Service/Event", "Member/Visitor", "Department", "Status", "Recorded By", "Notes", "Actions"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {filtered.map((record) => <tr className="border-t border-slate-100" key={record.id}><td className="px-5 py-4 font-semibold text-navy">{record.date}</td><td className="px-5 py-4 text-slate-600">{record.categoryName}</td><td className="px-5 py-4"><div className="font-semibold text-navy">{record.memberName || record.visitorName}</div><div className="text-xs text-slate-400">{record.memberNumber || "Visitor"}</div></td><td className="px-5 py-4 text-slate-600">{record.departmentName || "-"}</td><td className="px-5 py-4"><StatusBadge tone={statusTone(record.status)}>{record.status}</StatusBadge></td><td className="px-5 py-4 text-slate-600">{record.recordedBy}</td><td className="px-5 py-4 text-slate-500">{record.notes || "-"}</td><td className="px-5 py-4"><Button type="button" disabled={!canManage} variant="ghost" size="icon" aria-label={`Edit attendance for ${record.memberName || record.visitorName}`} onClick={() => openForm(record)}><Pencil className="h-4 w-4" /></Button><Button type="button" disabled={!canManage} variant="ghost" size="icon" aria-label={`Delete attendance for ${record.memberName || record.visitorName}`} onClick={() => remove(record)}><Trash2 className="h-4 w-4 text-rose-600" /></Button></td></tr>)}
                {filtered.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={8}>No attendance records found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader><div><h2 className="font-bold text-navy">Department Attendance Report</h2><p className="mt-1 text-xs text-slate-400">Present and late counts by department.</p></div></CardHeader><CardContent className="space-y-2">{departmentTotals.length ? departmentTotals.map(([department, count]) => <div className="flex justify-between rounded-lg border border-slate-100 p-3 text-sm" key={department}><span className="text-slate-600">{department}</span><span className="font-bold text-churchblue">{count}</span></div>) : <p className="text-sm text-slate-500">No department attendance this month.</p>}</CardContent></Card>
        <Card><CardHeader><div><h2 className="font-bold text-navy">Member Attendance History</h2><p className="mt-1 text-xs text-slate-400">Top attendance records in current filters.</p></div></CardHeader><CardContent className="space-y-2">{memberHistory.length ? memberHistory.map(([member, count]) => <div className="flex justify-between rounded-lg border border-slate-100 p-3 text-sm" key={member}><span className="text-slate-600">{member}</span><span className="font-bold text-churchblue">{count}</span></div>) : <p className="text-sm text-slate-500">No member history for current filters.</p>}</CardContent></Card>
        <Card><CardHeader><div><h2 className="font-bold text-navy">Active Member Roster</h2><p className="mt-1 text-xs text-slate-400">Quick reference for attendance recording.</p></div></CardHeader><CardContent className="space-y-3">{members.slice(0, 5).map((member) => <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3" key={member.id}><MemberAvatar alt={member.name} size="sm" src={member.photo} /><div className="min-w-0"><p className="truncate text-sm font-bold text-navy">{member.name}</p><p className="truncate text-xs text-slate-400">{member.department}</p></div></div>)}</CardContent></Card>
      </section>

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={save}><div className="sticky top-0 z-10 flex justify-between border-b border-slate-100 bg-white p-5"><div><h2 className="font-bold text-navy">{editing ? "Edit Attendance" : "Record Attendance"}</h2><p className="mt-1 text-xs text-slate-400">Record member or visitor attendance for Hamburg Ghana SDA Church.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close attendance form" onClick={closeForm}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Date<input className={fieldClass} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label className="text-sm font-semibold text-slate-700">Service/Event Type<select className={fieldClass} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">Select type</option>{categories.filter((category) => category.isActive || category.id === form.categoryId).map((category) => <option disabled={!category.isActive && category.id !== form.categoryId} key={category.id} value={category.id}>{category.name}{category.isActive ? "" : " (Inactive)"}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Member<select className={fieldClass} value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value, visitorName: event.target.value ? "" : form.visitorName })}><option value="">Visitor / no member selected</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.memberNumber})</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Visitor Name<input className={fieldClass} value={form.visitorName} onChange={(event) => setForm({ ...form, visitorName: event.target.value, memberId: event.target.value ? "" : form.memberId })} placeholder="Required for visitor attendance" /></label><label className="text-sm font-semibold text-slate-700">Status<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AttendanceStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Department<select className={fieldClass} value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">No department / not applicable</option>{departments.filter((department) => department.isActive || department.id === form.departmentId).map((department) => <option disabled={!department.isActive && department.id !== form.departmentId} key={department.id} value={department.id}>{department.name}{department.isActive ? "" : " (Inactive)"}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Attendance"}</Button></div></form></div>}
    </div>
  );
}
