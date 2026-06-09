"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Pencil, Plus,
  Repeat2, Search, Sparkles, Trash2, UsersRound, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type EventCategory = "Sabbath Program" | "Camp Meeting" | "Evangelism Campaign" | "Youth Congress" | "Other";
type Recurrence = "None" | "Weekly" | "Monthly" | "Yearly";
type DepartmentOption = { id: string; name: string; isActive: boolean };
type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  location: string;
  recurrence: Recurrence;
  recurrenceUntil: string;
  status: "Published" | "Draft" | "Cancelled";
  departmentId: string;
  departmentName: string;
};
type EventRegistration = { id: string; eventId: string; status: "Registered" | "Attended" | "Cancelled"; confirmed: boolean };

const categories: { name: EventCategory; tone: string; icon: typeof CalendarDays }[] = [
  { name: "Sabbath Program", tone: "bg-blue-50 text-churchblue", icon: CalendarDays },
  { name: "Camp Meeting", tone: "bg-amber-50 text-amber-700", icon: UsersRound },
  { name: "Evangelism Campaign", tone: "bg-emerald-50 text-emerald-700", icon: Sparkles },
  { name: "Youth Congress", tone: "bg-purple-50 text-purple-700", icon: UsersRound },
  { name: "Other", tone: "bg-slate-100 text-slate-600", icon: CalendarDays },
];

const seedEvents: CalendarEvent[] = [
  { id: "1", title: "Family Sabbath & Fellowship", description: "A special Sabbath service followed by church family fellowship.", category: "Sabbath Program", startsAt: "2026-06-20T09:30", endsAt: "2026-06-20T17:00", location: "Main Sanctuary & Church Hall", recurrence: "None", recurrenceUntil: "", status: "Published", departmentId: "", departmentName: "" },
  { id: "2", title: "Youth Congress Hamburg", description: "Worship, workshops, and fellowship for young adults.", category: "Youth Congress", startsAt: "2026-06-27T10:00", endsAt: "2026-06-28T17:00", location: "Hamburg-Mitte", recurrence: "None", recurrenceUntil: "", status: "Published", departmentId: "", departmentName: "" },
  { id: "3", title: "Sabbath School & Worship Service", description: "Weekly Sabbath School and divine worship service.", category: "Sabbath Program", startsAt: "2026-06-06T09:30", endsAt: "2026-06-06T13:30", location: "Main Sanctuary", recurrence: "Weekly", recurrenceUntil: "2026-12-26", status: "Published", departmentId: "", departmentName: "" },
  { id: "4", title: "Hamburg Evangelism Campaign", description: "Community Bible teaching and outreach series.", category: "Evangelism Campaign", startsAt: "2026-07-11T18:00", endsAt: "2026-07-18T20:00", location: "Church Hall", recurrence: "None", recurrenceUntil: "", status: "Published", departmentId: "", departmentName: "" },
  { id: "5", title: "Northern Germany Camp Meeting", description: "Annual spiritual retreat and church fellowship weekend.", category: "Camp Meeting", startsAt: "2026-08-14T16:00", endsAt: "2026-08-16T14:00", location: "Schleswig-Holstein", recurrence: "Yearly", recurrenceUntil: "", status: "Published", departmentId: "", departmentName: "" },
];

const emptyEvent: Omit<CalendarEvent, "id"> = {
  title: "", description: "", category: "Sabbath Program", startsAt: "", endsAt: "",
  location: "", recurrence: "None", recurrenceUntil: "", status: "Published", departmentId: "", departmentName: "",
};
const storageKey = "hamburg-ghana-sda-calendar";
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function titleCase(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function registrationStatus(value: string | null): EventRegistration["status"] {
  const status = titleCase(value);
  if (status === "Attended" || status === "Cancelled") return status;
  return "Registered";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function eventPayload(event: Omit<CalendarEvent, "id">) {
  return {
    title: event.title,
    description: event.description || null,
    event_type: event.category,
    starts_at: new Date(event.startsAt).toISOString(),
    ends_at: event.endsAt ? new Date(event.endsAt).toISOString() : null,
    location: event.location || null,
    recurrence: event.recurrence.toLowerCase(),
    recurrence_until: event.recurrenceUntil || null,
    status: event.status.toLowerCase(),
    department_id: event.departmentId || null,
  };
}

function getDaysInMonth(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
}

export function CalendarManagement() {
  const [records, setRecords] = useState<CalendarEvent[]>([]);
  const [viewDate, setViewDate] = useState(new Date(2026, 5, 1));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EventCategory | "All Events">("All Events");
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<Omit<CalendarEvent, "id">>(emptyEvent);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [canManage, setCanManage] = useState(!createClient());
  const [memberId, setMemberId] = useState("");
  const [memberLookupComplete, setMemberLookupComplete] = useState(!createClient());
  const [memberLookupMessage, setMemberLookupMessage] = useState("");
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  useEffect(() => {
    async function loadEvents() {
      const supabase = createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setMemberLookupComplete(false);
          setMemberLookupMessage("");
          const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          setCanManage((roleRows ?? []).some(({ role }) => ["super_admin", "pastor", "elder", "church_clerk", "secretary", "department_head"].includes(role)));
          const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
          const loginEmail = user.email ?? profile?.email ?? "";
          const { data: profileMember } = await supabase.from("members").select("id").eq("profile_id", user.id).maybeSingle();
          let member = profileMember;
          if (!member?.id && loginEmail) {
            const { data: emailMember } = await supabase.from("members").select("id").ilike("email", loginEmail).maybeSingle();
            member = emailMember;
          }
          if (!member?.id && profile?.full_name) {
            const { data: nameMember } = await supabase.from("members").select("id").ilike("full_name", profile.full_name).maybeSingle();
            member = nameMember;
          }
          if (member?.id) {
            setMemberId(member.id);
            const { data: registrationRows, error: registrationError } = await supabase.from("event_registrations").select("*").eq("member_id", member.id);
            if (registrationError) {
              setNotice(`Event registration table is not ready yet: ${registrationError.message}. Apply migration 202606090001_event_registrations_table.sql in Supabase.`);
            } else {
              setRegistrations((registrationRows ?? []).map((row) => ({ id: row.id, eventId: row.event_id, status: registrationStatus(row.registration_status), confirmed: Boolean(row.attendance_confirmed) })));
            }
          } else {
            setMemberId("");
            setRegistrations([]);
            setMemberLookupMessage("Member profile required");
          }
          setMemberLookupComplete(true);
        } else {
          setMemberLookupComplete(true);
        }
        const [{ data: departmentRows }, { data }] = await Promise.all([
          supabase.from("departments").select("id, name, is_active").order("name"),
          supabase.from("events").select("*").order("starts_at"),
        ]);
        const departmentOptions = (departmentRows ?? []).map((department) => ({ id: department.id, name: department.name, isActive: Boolean(department.is_active) }));
        setDepartments(departmentOptions);
        if (data?.length) {
          setRecords(data.map((row) => {
            const department = departmentOptions.find((item) => item.id === row.department_id);
            return {
            id: row.id,
            title: row.title,
            description: row.description ?? "",
            category: (row.event_type || "Other") as EventCategory,
            startsAt: row.starts_at.slice(0, 16),
            endsAt: row.ends_at?.slice(0, 16) ?? "",
            location: row.location ?? "",
            recurrence: titleCase(row.recurrence || "none") as Recurrence,
            recurrenceUntil: row.recurrence_until ?? "",
            status: titleCase(row.status) as CalendarEvent["status"],
            departmentId: row.department_id ?? "",
            departmentName: department?.name ?? "",
          };
          }));
          return;
        }
        setRecords([]);
        return;
      }
      const stored = window.localStorage.getItem(storageKey);
      setRecords(stored ? JSON.parse(stored) : seedEvents);
    }
    loadEvents();
  }, []);

  useEffect(() => {
    if (!createClient() && records.length) window.localStorage.setItem(storageKey, JSON.stringify(records));
  }, [records]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((event) => (category === "All Events" || event.category === category)
      && (!normalized || Object.values(event).some((value) => String(value).toLowerCase().includes(normalized))));
  }, [category, query, records]);
  const monthEvents = records.filter(({ startsAt }) => {
    const date = new Date(startsAt);
    return date.getFullYear() === viewDate.getFullYear() && date.getMonth() === viewDate.getMonth();
  });
  const monthLabel = viewDate.toLocaleString("en-GB", { month: "long", year: "numeric" });

  function openForm(event?: CalendarEvent) {
    setEditing(event ?? null);
    setForm(event ?? emptyEvent);
    setShowForm(true);
  }

  async function saveEvent(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const supabase = createClient();
    let saved: CalendarEvent = { ...form, id: editing?.id ?? crypto.randomUUID() };
    if (supabase) {
      const request = editing ? supabase.from("events").update(eventPayload(form)).eq("id", editing.id).select().single() : supabase.from("events").insert(eventPayload(form)).select().single();
      const { data, error } = await request;
      if (error) { setNotice(`Unable to save event: ${error.message}`); return; }
      saved = { ...saved, id: data.id, departmentName: departments.find((department) => department.id === form.departmentId)?.name ?? "" };
    }
    setRecords((current) => editing ? current.map((event) => event.id === editing.id ? saved : event) : [...current, saved]);
    setNotice(editing ? "Event updated." : "Event added to the calendar.");
    setShowForm(false);
  }

  async function deleteEvent(event: CalendarEvent) {
    if (!window.confirm(`Delete ${event.title}? This cannot be undone.`)) return;
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) { setNotice(`Unable to delete event: ${error.message}`); return; }
    }
    setRecords((current) => current.filter(({ id }) => id !== event.id));
    setNotice("Event deleted.");
  }

  async function registerForEvent(event: CalendarEvent) {
    if (!memberId) { setNotice("Member profile required"); return; }
    if (!isUuid(event.id) || !isUuid(memberId)) {
      setNotice("Unable to register: this event or member profile is not using a valid Supabase UUID. Please refresh after events are loaded from Supabase.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const { data, error } = await supabase.from("event_registrations").upsert({
      event_id: event.id,
      member_id: memberId,
      registration_status: "registered",
      attendance_confirmed: false,
      confirmed_at: null,
    }, { onConflict: "event_id,member_id" }).select().single();
    if (error) { setNotice(`Unable to register: ${error.message}`); return; }
    setRegistrations((current) => {
      const next = { id: data.id, eventId: data.event_id, status: registrationStatus(data.registration_status), confirmed: Boolean(data.attendance_confirmed) };
      return current.some((item) => item.eventId === event.id) ? current.map((item) => item.eventId === event.id ? next : item) : [...current, next];
    });
    setNotice(`Registered for ${event.title}.`);
  }

  async function cancelRegistration(event: CalendarEvent) {
    const registration = registrations.find((item) => item.eventId === event.id);
    if (!registration) return;
    if (!isUuid(registration.id)) {
      setNotice("Unable to cancel registration: registration record is not using a valid Supabase UUID.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("event_registrations").update({ registration_status: "cancelled", attendance_confirmed: false, confirmed_at: null }).eq("id", registration.id);
    if (error) { setNotice(`Unable to cancel registration: ${error.message}`); return; }
    setRegistrations((current) => current.map((item) => item.id === registration.id ? { ...item, status: "Cancelled", confirmed: false } : item));
    setNotice(`Registration cancelled for ${event.title}.`);
  }

  async function confirmAttendance(event: CalendarEvent) {
    const registration = registrations.find((item) => item.eventId === event.id);
    if (!registration) { await registerForEvent(event); return; }
    if (!isUuid(registration.id)) {
      setNotice("Unable to confirm attendance: registration record is not using a valid Supabase UUID.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("event_registrations").update({ registration_status: "attended", attendance_confirmed: true, confirmed_at: new Date().toISOString() }).eq("id", registration.id);
    if (error) { setNotice(`Unable to confirm attendance: ${error.message}`); return; }
    setRegistrations((current) => current.map((item) => item.id === registration.id ? { ...item, status: "Attended", confirmed: true } : item));
    setNotice(`Attendance confirmed for ${event.title}.`);
  }

  return (
    <div className="space-y-6">
      <PageHeading title="Church Calendar" description="Plan Sabbath programs, campaigns, meetings, and church events." />
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categories.slice(0, 4).map(({ name, tone, icon: Icon }) => <Card className="cursor-pointer p-4 transition hover:border-blue-200" key={name} onClick={() => setCategory(name)}><div className={`inline-flex rounded-lg p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold text-navy">{name}</p><p className="mt-1 text-xs text-slate-400">{records.filter((event) => event.category === name).length} scheduled</p></Card>)}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between"><div><h2 className="font-bold text-navy">{monthLabel}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church calendar</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button></div></div>
          <div className="mt-5 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div className="pb-2" key={day}>{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">{getDaysInMonth(viewDate).map((day, index) => <div className={`min-h-16 rounded-lg border p-1.5 ${day ? "border-slate-100 bg-white" : "border-transparent"}`} key={`${day}-${index}`}>{day && <><p className="text-xs font-semibold text-slate-500">{day}</p>{monthEvents.filter(({ startsAt }) => new Date(startsAt).getDate() === day).slice(0, 2).map((event) => <p className="mt-1 truncate rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-churchblue" key={event.id}>{event.title}</p>)}</>}</div>)}</div>
        </Card>
        <Card className="p-5">
          <div className="flex justify-between gap-3"><div><h2 className="font-bold text-navy">Upcoming Events</h2><p className="mt-1 text-xs text-slate-400">Programs and activities</p></div>{canManage ? <Button size="sm" onClick={() => openForm()}><Plus className="h-4 w-4" /> Add Event</Button> : <StatusBadge tone="slate">Read-only</StatusBadge>}</div>
          <div className="mt-4 space-y-3">{records.slice(0, 4).map((event) => <div className="flex gap-3 rounded-lg border border-slate-100 p-3" key={event.id}><div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-center"><p className="text-[9px] font-bold text-churchblue">{new Date(event.startsAt).toLocaleString("en", { month: "short" }).toUpperCase()}</p><p className="text-base font-bold text-navy">{new Date(event.startsAt).getDate()}</p></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy">{event.title}</p><p className="mt-1 text-xs text-slate-400">{event.location}</p></div></div>)}</div>
        </Card>
      </section>
      <Card>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 md:flex-row"><label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search church events..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="flex gap-2"><select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600" value={category} onChange={(event) => setCategory(event.target.value as EventCategory | "All Events")}><option>All Events</option>{categories.map(({ name }) => <option key={name}>{name}</option>)}</select>{canManage && <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Add Event</Button>}</div></div>
        {memberLookupMessage && <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{memberLookupMessage}</div>}
        <div className="divide-y divide-slate-100">{filtered.map((event) => {
          const registration = registrations.find((item) => item.eventId === event.id);
          const isPublished = event.status === "Published";
          const isFutureEvent = new Date(event.startsAt).getTime() >= Date.now();
          const isFuturePublished = isPublished && isFutureEvent;
          const hasMember = Boolean(memberId);
          const alreadyRegistered = registration?.status === "Registered";
          const hasValidEventId = isUuid(event.id);
          const hasValidRegistrationIds = isUuid(event.id) && isUuid(memberId);
          const canRegister = Boolean(hasMember && hasValidRegistrationIds && isFuturePublished && (!registration || registration.status === "Cancelled"));
          const registerDebugReason = canRegister ? "none" : !isPublished ? "isPublished=false" : !isFutureEvent ? "isFutureEvent=false" : !hasMember ? "hasMember=false" : alreadyRegistered ? "alreadyRegistered=true" : !hasValidEventId ? "hasValidEventId=false" : !isUuid(memberId) ? "hasValidMemberId=false" : registration && registration.status !== "Cancelled" ? `registration.status=${registration.status}` : "unknown";
          const canCancel = Boolean(memberId && hasValidRegistrationIds && isFuturePublished && registration && registration.status === "Registered" && !registration.confirmed);
          return <div className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center" key={event.id}><div className="flex gap-4"><div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50"><p className="text-[10px] font-bold text-churchblue">{new Date(event.startsAt).toLocaleString("en", { month: "short" }).toUpperCase()}</p><p className="text-xl font-bold text-navy">{new Date(event.startsAt).getDate()}</p></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-navy">{event.title}</h3><StatusBadge tone="blue">{event.category}</StatusBadge>{event.departmentName && <StatusBadge tone="slate">{event.departmentName}</StatusBadge>}{event.recurrence !== "None" && <StatusBadge tone="gold"><Repeat2 className="mr-1 h-3 w-3" />{event.recurrence}</StatusBadge>}{registration && <StatusBadge tone={registration.confirmed || registration.status === "Attended" ? "green" : registration.status === "Cancelled" ? "slate" : "gold"}>{registration.confirmed ? "Attendance Confirmed" : registration.status}</StatusBadge>}</div><p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{event.startsAt.replace("T", " ")}{event.endsAt && ` to ${event.endsAt.replace("T", " ")}`}</p><p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{event.location}</p><p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{`Debug:
isPublished=${String(isPublished)}
isFutureEvent=${String(isFutureEvent)}
hasMember=${String(hasMember)}
alreadyRegistered=${String(alreadyRegistered)}
hasValidEventId=${String(hasValidEventId)}
canRegister=${String(canRegister)}
reason=${registerDebugReason}
currentMember.id=${memberId || "Member profile required"}
event.id=${event.id}
event.starts_at=${event.startsAt}`}</p>{isFuturePublished && <div className="mt-3 flex flex-wrap items-center gap-2">{registration?.status === "Registered" && <StatusBadge tone="green">Registered</StatusBadge>}{memberLookupComplete && !memberId && <Button size="sm" variant="outline" disabled>Member profile required</Button>}{canRegister && <Button size="sm" variant="outline" onClick={() => registerForEvent(event)}>{registration?.status === "Cancelled" ? "Register Again" : "Register"}</Button>}{canCancel && <Button size="sm" variant="outline" onClick={() => cancelRegistration(event)}>Cancel Registration</Button>}{memberId && registration && registration.status === "Registered" && !registration.confirmed && <Button size="sm" variant="outline" onClick={() => confirmAttendance(event)}><CheckCircle2 className="h-4 w-4" /> Confirm Attendance</Button>}</div>}</div></div><div className="flex flex-wrap justify-end gap-1 self-end md:self-auto">{canManage && <><Button variant="ghost" size="icon" aria-label={`Edit ${event.title}`} onClick={() => openForm(event)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${event.title}`} onClick={() => deleteEvent(event)}><Trash2 className="h-4 w-4 text-rose-600" /></Button></>}</div></div>;
        })}</div>
      </Card>
      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={saveEvent}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 className="font-bold text-navy">{editing ? "Edit Event" : "Add Event"}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church calendar entry</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close event form" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2">{[["Event Title", "title", "text"], ["Location", "location", "text"], ["Starts At", "startsAt", "datetime-local"], ["Ends At", "endsAt", "datetime-local"], ["Repeat Until", "recurrenceUntil", "date"]].map(([label, key, type]) => <label className="text-sm font-semibold text-slate-700" key={key}>{label}<input className={fieldClass} type={type} value={String(form[key as keyof typeof form])} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={["title", "startsAt"].includes(key)} /></label>)}{[["Category", "category", categories.map(({ name }) => name)], ["Recurring Event", "recurrence", ["None", "Weekly", "Monthly", "Yearly"]], ["Status", "status", ["Published", "Draft", "Cancelled"]]].map(([label, key, options]) => <label className="text-sm font-semibold text-slate-700" key={String(key)}>{label}<select className={fieldClass} value={String(form[key as keyof typeof form])} onChange={(event) => setForm({ ...form, [String(key)]: event.target.value })}>{(options as string[]).map((option) => <option key={option}>{option}</option>)}</select></label>)}<label className="text-sm font-semibold text-slate-700">Organizing Department<select className={fieldClass} value={form.departmentId} onChange={(event) => { const department = departments.find((item) => item.id === event.target.value); setForm({ ...form, departmentId: event.target.value, departmentName: department?.name ?? "" }); }}><option value="">No department assigned</option>{departments.map((department) => <option disabled={!department.isActive && department.id !== form.departmentId} key={department.id} value={department.id}>{department.name}{department.isActive ? "" : " (Inactive)"}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit">{editing ? "Save Changes" : "Add Event"}</Button></div></form></div>}
    </div>
  );
}
