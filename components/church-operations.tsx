"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Baby, CalendarDays, CheckCircle2, Church, ClipboardList, HeartPulse, Home, Plus,
  RefreshCw, Search, UserPlus, UsersRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";

type OperationType =
  | "visitor"
  | "baptism_candidate"
  | "child_dedication"
  | "marriage"
  | "funeral"
  | "membership_transfer"
  | "prayer_tracking"
  | "pastoral_visit"
  | "sick_member"
  | "calendar_integration";

type OperationRecord = {
  id: string;
  type: OperationType;
  title: string;
  primaryName: string;
  contact: string;
  status: string;
  recordDate: string;
  followUpDate: string;
  notes: string;
  eventId: string;
  details: Record<string, string>;
};

type ChurchEvent = { id: string; title: string; startsAt: string };

const modules: { id: OperationType; title: string; description: string; icon: typeof ClipboardList; statusOptions: string[]; fields: string[] }[] = [
  { id: "visitor", title: "Visitor Management", description: "First-time visitors, contact information, and follow-up status.", icon: UserPlus, statusOptions: ["New", "Contacted", "Visited", "Joined", "Closed"], fields: ["Visit source", "Assigned follow-up leader"] },
  { id: "baptism_candidate", title: "Baptism Candidates", description: "Candidate records, Bible study progress, and baptism date.", icon: Church, statusOptions: ["Interested", "Bible Study", "Ready", "Baptized", "Paused"], fields: ["Bible study progress", "Baptism date"] },
  { id: "child_dedication", title: "Child Dedication Records", description: "Track child dedication requests, dates, parents, and officiants.", icon: Baby, statusOptions: ["Requested", "Scheduled", "Completed", "Cancelled"], fields: ["Child name", "Parents", "Dedication date"] },
  { id: "marriage", title: "Marriage Records", description: "Marriage counseling, ceremony dates, and official records.", icon: HeartPulse, statusOptions: ["Counseling", "Scheduled", "Completed", "Archived"], fields: ["Spouse names", "Marriage date", "Officiating pastor"] },
  { id: "funeral", title: "Funeral Records", description: "Pastoral care, funeral service details, and family contacts.", icon: Home, statusOptions: ["Planning", "Scheduled", "Completed", "Follow-up"], fields: ["Deceased name", "Family contact", "Service date"] },
  { id: "membership_transfer", title: "Membership Transfer", description: "Incoming and outgoing transfer requests and approvals.", icon: RefreshCw, statusOptions: ["Incoming", "Outgoing", "Requested", "Approved", "Completed"], fields: ["Transfer direction", "From church", "To church"] },
  { id: "prayer_tracking", title: "Prayer Request Tracking", description: "Follow prayer needs from submission through pastoral care.", icon: ClipboardList, statusOptions: ["Submitted", "Praying", "Answered", "Archived"], fields: ["Prayer category", "Care action"] },
  { id: "pastoral_visit", title: "Pastoral Visit Records", description: "Schedule and record pastoral home, hospital, and care visits.", icon: UsersRound, statusOptions: ["Requested", "Scheduled", "Completed", "Follow-up"], fields: ["Visit type", "Visit location", "Pastor/Elder"] },
  { id: "sick_member", title: "Sick Member Tracking", description: "Track illness, care needs, visitation, and recovery status.", icon: HeartPulse, statusOptions: ["Reported", "Under Care", "Recovering", "Recovered"], fields: ["Care need", "Hospital/Home", "Care coordinator"] },
  { id: "calendar_integration", title: "Church Calendar Integration", description: "Link operational care items to church events and calendar dates.", icon: CalendarDays, statusOptions: ["Planned", "Scheduled", "Published", "Completed"], fields: ["Calendar purpose", "Event owner"] },
];

const emptyForm: Omit<OperationRecord, "id"> = {
  type: "visitor",
  title: "",
  primaryName: "",
  contact: "",
  status: "New",
  recordDate: new Date().toISOString().slice(0, 10),
  followUpDate: "",
  notes: "",
  eventId: "",
  details: {},
};

const storageKey = "hamburg-ghana-sda-operations";
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function toTitle(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toSnake(value: string) {
  return value.toLowerCase().replaceAll(" ", "_").replaceAll("/", "_");
}

function normalizeDetails(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, detail]) => [key, String(detail ?? "")]),
  );
}

function fromRow(row: Record<string, unknown>): OperationRecord {
  return {
    id: String(row.id),
    type: row.operation_type as OperationType,
    title: String(row.title ?? ""),
    primaryName: String(row.primary_name ?? ""),
    contact: String(row.contact_info ?? ""),
    status: toTitle(String(row.status ?? "new")),
    recordDate: String(row.record_date ?? ""),
    followUpDate: String(row.follow_up_date ?? ""),
    notes: String(row.notes ?? ""),
    eventId: String(row.event_id ?? ""),
    details: normalizeDetails(row.details),
  };
}

function toPayload(form: Omit<OperationRecord, "id">) {
  return {
    operation_type: form.type,
    title: form.title,
    primary_name: form.primaryName || null,
    contact_info: form.contact || null,
    status: toSnake(form.status),
    record_date: form.recordDate,
    follow_up_date: form.followUpDate || null,
    notes: form.notes || null,
    event_id: form.eventId || null,
    details: form.details,
  };
}

export function ChurchOperations() {
  const [records, setRecords] = useState<OperationRecord[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [activeType, setActiveType] = useState<OperationType>("visitor");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [form, setForm] = useState<Omit<OperationRecord, "id">>(emptyForm);
  const [editing, setEditing] = useState<OperationRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(!createClient());

  const activeModule = modules.find((module) => module.id === activeType) ?? modules[0];
  const activeRecords = records.filter((record) => record.type === activeType);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activeRecords.filter((record) =>
      (status === "All Statuses" || record.status === status)
      && (!normalized || Object.values({ ...record, ...record.details }).some((value) => String(value).toLowerCase().includes(normalized))),
    );
  }, [activeRecords, query, status]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        const stored = window.localStorage.getItem(storageKey);
        setRecords(stored ? JSON.parse(stored) : []);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        setCanManage((roleRows ?? []).some(({ role }) => ["super_admin", "pastor", "elder", "church_clerk", "secretary"].includes(role)));
      }

      const [operationsResult, eventsResult] = await Promise.all([
        supabase.from("church_operation_records").select("*").order("record_date", { ascending: false }),
        supabase.from("events").select("id, title, starts_at").order("starts_at", { ascending: true }).limit(50),
      ]);
      if (operationsResult.error) setError(`${operationsResult.error.message}. Apply migration 202606080001_church_operations_module.sql in Supabase.`);
      else setRecords((operationsResult.data ?? []).map(fromRow));
      setEvents((eventsResult.data ?? []).map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at?.slice(0, 10) ?? "" })));
      setLoading(false);
    }
    load();
  }, []);

  function openForm(record?: OperationRecord) {
    if (!canManage) return;
    const selectedModule = record ? modules.find((item) => item.id === record.type) ?? activeModule : activeModule;
    setEditing(record ?? null);
    setForm(
      record
        ? { ...record }
        : {
            ...emptyForm,
            type: selectedModule.id,
            status: selectedModule.statusOptions[0],
            details: Object.fromEntries(selectedModule.fields.map((field) => [field, ""])),
          },
    );
    setShowForm(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const supabase = createClient();
    if (supabase) {
      const request = editing
        ? supabase.from("church_operation_records").update(toPayload(form)).eq("id", editing.id).select().single()
        : supabase.from("church_operation_records").insert(toPayload(form)).select().single();
      const { data, error: saveError } = await request;
      if (saveError) {
        setError(saveError.message);
        setSaving(false);
        return;
      }
      setRecords((current) => editing ? current.map((item) => item.id === editing.id ? fromRow(data) : item) : [fromRow(data), ...current]);
    } else {
      const next = editing ? records.map((item) => item.id === editing.id ? { ...form, id: editing.id } : item) : [{ ...form, id: crypto.randomUUID() }, ...records];
      setRecords(next);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
    setNotice(editing ? "Operation record updated." : "Operation record created.");
    setSaving(false);
    setShowForm(false);
  }

  async function updateStatus(record: OperationRecord, nextStatus: string) {
    const supabase = createClient();
    if (supabase) {
      const { error: updateError } = await supabase.from("church_operation_records").update({ status: toSnake(nextStatus) }).eq("id", record.id);
      if (updateError) { setError(updateError.message); return; }
    }
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status: nextStatus } : item));
    setNotice(`${record.title} marked ${nextStatus}.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <PageHeading title="Church Operations" description="Coordinate visitors, pastoral care, candidates, records, transfers, prayer tracking, and calendar-linked church operations." />
        {canManage && <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Add Operation Record</Button>}
      </div>
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {modules.map(({ id, title, description, icon: Icon }) => {
          const count = records.filter((record) => record.type === id).length;
          return <button className={`rounded-xl border p-4 text-left transition hover:border-churchblue/40 hover:shadow-card ${activeType === id ? "border-churchblue bg-blue-50" : "border-slate-100 bg-white"}`} key={id} onClick={() => { setActiveType(id); setStatus("All Statuses"); }}><Icon className="h-5 w-5 text-churchblue" /><div className="mt-3 flex items-start justify-between gap-3"><h2 className="text-sm font-bold text-navy">{title}</h2><StatusBadge tone="blue">{count}</StatusBadge></div><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p></button>;
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Summary label="Open Follow-ups" value={records.filter((record) => record.followUpDate && !["Completed", "Closed", "Archived", "Recovered"].includes(record.status)).length} />
        <Summary label="Calendar Linked" value={records.filter((record) => record.eventId).length} />
        <Summary label="This Month" value={records.filter((record) => record.recordDate.startsWith(new Date().toISOString().slice(0, 7))).length} />
        <Summary label="Care Records" value={records.filter((record) => ["pastoral_visit", "sick_member", "prayer_tracking"].includes(record.type)).length} />
      </section>

      <Card>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row">
          <div><h2 className="font-bold text-navy">{activeModule.title}</h2><p className="mt-1 text-xs text-slate-400">{activeModule.description}</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search operations..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <select className={fieldClass.replace("mt-1.5 ", "")} value={status} onChange={(event) => setStatus(event.target.value)}><option>All Statuses</option>{activeModule.statusOptions.map((option) => <option key={option}>{option}</option>)}</select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Title", "Person / Family", "Contact", "Status", "Record Date", "Follow-up", "Calendar", "Actions"].map((label) => <th className="px-5 py-3.5 font-semibold" key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {loading && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={8}>Loading church operations...</td></tr>}
              {!loading && filtered.map((record) => <tr className="border-b border-slate-100 last:border-0" key={record.id}><td className="px-5 py-4"><p className="font-bold text-navy">{record.title}</p><p className="mt-1 line-clamp-1 text-xs text-slate-400">{record.notes || "-"}</p></td><td className="px-5 py-4 text-slate-600">{record.primaryName || "-"}</td><td className="px-5 py-4 text-slate-600">{record.contact || "-"}</td><td className="px-5 py-4"><StatusBadge tone={["Completed", "Answered", "Recovered", "Baptized", "Joined"].includes(record.status) ? "green" : "gold"}>{record.status}</StatusBadge></td><td className="px-5 py-4 text-slate-600">{record.recordDate}</td><td className="px-5 py-4 text-slate-600">{record.followUpDate || "-"}</td><td className="px-5 py-4 text-slate-600">{events.find((event) => event.id === record.eventId)?.title ?? "-"}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-1">{canManage && <Button size="sm" variant="ghost" onClick={() => openForm(record)}>Edit</Button>}{canManage && activeModule.statusOptions.slice(-2).map((option) => <Button key={option} size="sm" variant="outline" onClick={() => updateStatus(record, option)}><CheckCircle2 className="h-4 w-4" /> {option}</Button>)}</div></td></tr>)}
              {!loading && filtered.length === 0 && <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={8}>No operation records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader><div><h2 className="font-bold text-navy">Church Calendar Integration</h2><p className="mt-1 text-xs text-slate-400">Upcoming church events available for linking to operations records.</p></div><CalendarDays className="h-5 w-5 text-churchblue" /></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">{events.slice(0, 6).map((event) => <div className="rounded-lg border border-slate-100 p-3" key={event.id}><p className="text-sm font-bold text-navy">{event.title}</p><p className="mt-1 text-xs text-slate-400">{event.startsAt}</p></div>)}{events.length === 0 && <p className="text-sm text-slate-500">No calendar events found.</p>}</CardContent>
      </Card>

      {showForm && <OperationModal activeModule={modules.find((module) => module.id === form.type) ?? activeModule} events={events} form={form} setForm={setForm} saving={saving} editing={editing} onClose={() => setShowForm(false)} onSubmit={save} />}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <Card className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-navy">{value}</p></Card>;
}

function OperationModal({ activeModule, events, form, setForm, saving, editing, onClose, onSubmit }: {
  activeModule: typeof modules[number];
  events: ChurchEvent[];
  form: Omit<OperationRecord, "id">;
  setForm: (form: Omit<OperationRecord, "id">) => void;
  saving: boolean;
  editing: OperationRecord | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5"><div><h2 className="font-bold text-navy">{editing ? "Edit" : "Add"} {activeModule.title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church operations record</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close operation form" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Title<input className={fieldClass} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Status<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{activeModule.statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Person / Family<input className={fieldClass} value={form.primaryName} onChange={(event) => setForm({ ...form, primaryName: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Contact Information<input className={fieldClass} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Record Date<input className={fieldClass} type="date" value={form.recordDate} onChange={(event) => setForm({ ...form, recordDate: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Follow-up / Scheduled Date<input className={fieldClass} type="date" value={form.followUpDate} onChange={(event) => setForm({ ...form, followUpDate: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Calendar Event<select className={fieldClass} value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })}><option value="">Not linked to calendar</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title} ({event.startsAt})</option>)}</select></label>{activeModule.fields.map((field) => <label className="text-sm font-semibold text-slate-700" key={field}>{field}<input className={fieldClass} value={form.details[field] ?? ""} onChange={(event) => setForm({ ...form, details: { ...form.details, [field]: event.target.value } })} /></label>)}<label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Record"}</Button></div></form></div>;
}
