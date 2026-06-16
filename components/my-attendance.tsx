"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ClipboardCheck, UserRoundCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";

type LinkedMember = { id: string; profile_id: string | null; email: string | null; member_number: string | null; full_name: string | null };

type AttendanceRow = {
  id: string;
  source: "Service" | "Event";
  title: string;
  date: string;
  status: string;
  checked_in_at: string;
  method?: string;
};

type AttendanceEntryRecord = {
  id: string;
  status: string | null;
  checked_in_at: string | null;
  attendance_sessions?: { service_name?: string | null; service_date?: string | null } | { service_name?: string | null; service_date?: string | null }[] | null;
};

type EventAttendanceRecord = {
  id: string;
  event_id: string;
  present: boolean | null;
  checked_in_at: string | null;
  checkin_method: string | null;
  events?: { title?: string | null; starts_at?: string | null } | { title?: string | null; starts_at?: string | null }[] | null;
};

type EventRegistrationRecord = {
  id: string;
  event_id: string;
  status: string | null;
  registration_status: string | null;
  attendance_confirmed: boolean | null;
  confirmed_at: string | null;
  events?: { title?: string | null; starts_at?: string | null } | { title?: string | null; starts_at?: string | null }[] | null;
};

function singleRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rowTimestamp(row: AttendanceRow) {
  return new Date(row.checked_in_at || row.date || 0).getTime();
}

export function MyAttendance() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage("Please sign in to view your attendance.");
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      const loginEmail = user.email ?? profile?.email ?? "";
      const memberSelect = "id, profile_id, email, member_number, full_name";
      const { data: profileMember, error: profileMemberError } = await supabase.from("members").select(memberSelect).eq("profile_id", user.id).maybeSingle();
      if (profileMemberError) console.error("Unable to load My Attendance member by public.members.profile_id", profileMemberError);
      let member = profileMember as LinkedMember | null;
      if (!member?.id && loginEmail) {
        const { data: emailMember, error: emailMemberError } = await supabase.from("members").select(memberSelect).eq("email", loginEmail).maybeSingle();
        if (emailMemberError) console.error("Unable to load My Attendance member by public.members.email", emailMemberError);
        member = emailMember as LinkedMember | null;
      }
      console.log("My Attendance member lookup", {
        authUserId: user.id,
        loginEmail,
        profileFullName: profile?.full_name ?? null,
        selectedMemberId: member?.id ?? null,
        selectedMemberProfileId: member?.profile_id ?? null,
        selectedMemberEmail: member?.email ?? null,
        selectedMemberNumber: member?.member_number ?? null,
        sourceColumns: "public.members.id, public.members.profile_id, public.members.email",
      });
      if (!member?.id || (member.profile_id !== user.id && (!loginEmail || member.email?.toLowerCase() !== loginEmail.toLowerCase()))) {
        setMessage(`No member profile is linked to this login yet. Link this login to public.members.profile_id = auth.users.id or set public.members.email to ${loginEmail || "the login email"}.`);
        setRows([]);
        setLoading(false);
        return;
      }
      const [serviceResult, eventAttendanceResult, registrationResult] = await Promise.all([
        supabase.from("attendance_entries").select("id, status, checked_in_at, attendance_sessions(service_name, service_date)").eq("member_id", member.id).order("checked_in_at", { ascending: false }),
        supabase.from("event_attendance").select("id, event_id, present, checked_in_at, checkin_method, events(title, starts_at)").eq("member_id", member.id).order("checked_in_at", { ascending: false }),
        supabase.from("event_registrations").select("id, event_id, status, registration_status, attendance_confirmed, confirmed_at, events(title, starts_at)").eq("member_id", member.id).eq("attendance_confirmed", true),
      ]);
      const errors = [serviceResult.error, eventAttendanceResult.error, registrationResult.error].filter(Boolean);
      if (errors.length) setMessage(errors.map((error) => error?.message).join(" "));

      const serviceRows = ((serviceResult.data ?? []) as AttendanceEntryRecord[]).map((row) => {
        const session = singleRelation(row.attendance_sessions);
        const checkedInAt = row.checked_in_at ?? session?.service_date ?? "";
        return {
          id: `service-${row.id}`,
          source: "Service" as const,
          title: session?.service_name ?? "Church Service",
          date: session?.service_date ?? checkedInAt.slice(0, 10),
          status: row.status ?? "present",
          checked_in_at: checkedInAt,
        };
      });

      const eventRows = new Map<string, AttendanceRow>();
      ((eventAttendanceResult.data ?? []) as EventAttendanceRecord[]).forEach((row) => {
        const event = singleRelation(row.events);
        const checkedInAt = row.checked_in_at ?? event?.starts_at ?? "";
        eventRows.set(row.event_id, {
          id: `event-${row.id}`,
          source: "Event",
          title: event?.title ?? "Church Event",
          date: (event?.starts_at ?? checkedInAt).slice(0, 10),
          status: row.present ? "present" : "absent",
          checked_in_at: checkedInAt,
          method: row.checkin_method ?? "manual",
        });
      });

      ((registrationResult.data ?? []) as EventRegistrationRecord[]).forEach((row) => {
        if (eventRows.has(row.event_id)) return;
        const event = singleRelation(row.events);
        const checkedInAt = row.confirmed_at ?? event?.starts_at ?? "";
        eventRows.set(row.event_id, {
          id: `registration-${row.id}`,
          source: "Event",
          title: event?.title ?? "Church Event",
          date: (event?.starts_at ?? checkedInAt).slice(0, 10),
          status: "present",
          checked_in_at: checkedInAt,
          method: titleCase(row.status ?? row.registration_status ?? "attended"),
        });
      });

      setRows([...serviceRows, ...eventRows.values()].sort((left, right) => rowTimestamp(right) - rowTimestamp(left)));
      setLoading(false);
    }
    load();
  }, []);

  const presentCount = useMemo(() => rows.filter((row) => row.status === "present").length, [rows]);

  return (
    <div className="space-y-6">
      <PageHeading title="My Attendance" description="Your personal attendance records for church services, events, and programs." />
      {message && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</p>}
      <section className="grid gap-4 md:grid-cols-3">
        <Summary label="Total Records" value={rows.length} icon={ClipboardCheck} />
        <Summary label="Present" value={presentCount} icon={UserRoundCheck} />
        <Summary label="Latest Records" value={rows.slice(0, 4).length} icon={CalendarCheck} />
      </section>
      <Card>
        <div className="border-b border-slate-100 p-4"><h2 className="font-bold text-navy">Attendance History</h2></div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading your attendance...</p> : rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No attendance history found.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Date", "Type", "Service/Event", "Status", "Checked In"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className="border-t border-slate-100" key={row.id}><td className="px-5 py-4 font-semibold text-navy">{row.date || row.checked_in_at.slice(0, 10)}</td><td className="px-5 py-4"><StatusBadge tone={row.source === "Event" ? "blue" : "slate"}>{row.source}</StatusBadge></td><td className="px-5 py-4 text-slate-600">{row.title}</td><td className="px-5 py-4"><StatusBadge tone={row.status === "present" ? "green" : "slate"}>{titleCase(row.status)}</StatusBadge></td><td className="px-5 py-4 text-slate-500">{row.checked_in_at ? row.checked_in_at.slice(0, 16).replace("T", " ") : "Recorded"}</td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ClipboardCheck }) {
  return <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{value}</p></div></Card>;
}
