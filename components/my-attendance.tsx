"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ClipboardCheck, UserRoundCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";

type AttendanceRow = {
  id: string;
  status: string;
  checked_in_at: string;
  attendance_sessions?: { service_name?: string | null; service_date?: string | null } | { service_name?: string | null; service_date?: string | null }[] | null;
};

function sessionValue(row: AttendanceRow, key: "service_name" | "service_date") {
  const session = Array.isArray(row.attendance_sessions) ? row.attendance_sessions[0] : row.attendance_sessions;
  return session?.[key] ?? "";
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      if (!user) return;
      const { data: member } = await supabase.from("members").select("id").eq("profile_id", user.id).maybeSingle();
      if (!member) {
        setMessage("No member profile is linked to this login yet.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from("attendance_entries").select("id, status, checked_in_at, attendance_sessions(service_name, service_date)").eq("member_id", member.id).order("checked_in_at", { ascending: false });
      if (error) setMessage(error.message);
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const presentCount = useMemo(() => rows.filter((row) => row.status === "present").length, [rows]);

  return (
    <div className="space-y-6">
      <PageHeading title="My Attendance" description="Your personal attendance records for church services and programs." />
      {message && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</p>}
      <section className="grid gap-4 md:grid-cols-3">
        <Summary label="Total Records" value={rows.length} icon={ClipboardCheck} />
        <Summary label="Present" value={presentCount} icon={UserRoundCheck} />
        <Summary label="Latest Records" value={rows.slice(0, 4).length} icon={CalendarCheck} />
      </section>
      <Card>
        <div className="border-b border-slate-100 p-4"><h2 className="font-bold text-navy">Attendance History</h2></div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading your attendance...</p> : rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No individual attendance records found yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Date", "Service", "Status", "Checked In"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className="border-t border-slate-100" key={row.id}><td className="px-5 py-4 font-semibold text-navy">{sessionValue(row, "service_date") || row.checked_in_at.slice(0, 10)}</td><td className="px-5 py-4 text-slate-600">{sessionValue(row, "service_name") || "Church Service"}</td><td className="px-5 py-4"><StatusBadge tone={row.status === "present" ? "green" : "slate"}>{titleCase(row.status)}</StatusBadge></td><td className="px-5 py-4 text-slate-500">{row.checked_in_at.slice(0, 16).replace("T", " ")}</td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ClipboardCheck }) {
  return <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{value}</p></div></Card>;
}
