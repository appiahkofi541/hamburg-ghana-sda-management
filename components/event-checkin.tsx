"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { createClient } from "@/lib/supabase/client";

type CheckinState = "loading" | "success" | "error";
type LinkedMember = { id: string; profile_id: string | null; email: string | null; member_number: string | null; full_name: string | null };
type EventRow = { id: string; title: string; starts_at: string; location: string | null; status: string | null };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function EventCheckin({ eventId }: { eventId: string }) {
  const [state, setState] = useState<CheckinState>("loading");
  const [message, setMessage] = useState("Checking you in...");
  const [event, setEvent] = useState<EventRow | null>(null);
  const [member, setMember] = useState<LinkedMember | null>(null);

  useEffect(() => {
    void checkIn();
    // The check-in routine should run once for the scanned event route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function findMember(supabase: NonNullable<ReturnType<typeof createClient>>, userId: string, email: string) {
    const memberSelect = "id, profile_id, email, member_number, full_name";
    const { data: profileMember, error: profileMemberError } = await supabase.from("members").select(memberSelect).eq("profile_id", userId).maybeSingle();
    if (profileMemberError) throw new Error(`Unable to load member by public.members.profile_id: ${profileMemberError.message}`);
    if (profileMember?.id) return profileMember as LinkedMember;
    if (!email) return null;
    const { data: emailMember, error: emailMemberError } = await supabase.from("members").select(memberSelect).eq("email", email).maybeSingle();
    if (emailMemberError) throw new Error(`Unable to load member by public.members.email: ${emailMemberError.message}`);
    return emailMember as LinkedMember | null;
  }

  async function checkIn() {
    const supabase = createClient();
    if (!supabase) {
      setState("error");
      setMessage("Supabase is not configured.");
      return;
    }
    if (!isUuid(eventId)) {
      setState("error");
      setMessage(`Invalid event link. public.event_attendance.event_id must be public.events.id, but received "${eventId}".`);
      return;
    }
    try {
      setState("loading");
      setMessage("Checking you in...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState("error");
        setMessage("Please log in first, then scan or open the QR code again.");
        return;
      }
      const { data: eventRow, error: eventError } = await supabase.from("events").select("id, title, starts_at, location, status").eq("id", eventId).maybeSingle();
      if (eventError) throw new Error(`Unable to load public.events row: ${eventError.message}`);
      if (!eventRow) throw new Error("Event not found.");
      setEvent(eventRow as EventRow);

      const linkedMember = await findMember(supabase, user.id, user.email ?? "");
      if (!linkedMember?.id) {
        setState("error");
        setMessage("Member profile is missing. Ask the church secretary to link your login to public.members.profile_id or public.members.email.");
        return;
      }
      setMember(linkedMember);
      const now = new Date().toISOString();
      const { error: registrationError } = await supabase.from("event_registrations").upsert({
        event_id: eventId,
        member_id: linkedMember.id,
        status: "attended",
        registration_status: "attended",
        registration_date: now,
        attendance_confirmed: true,
        confirmed_at: now,
      }, { onConflict: "event_id,member_id" });
      if (registrationError) throw new Error(`Unable to save public.event_registrations: ${registrationError.message}`);

      const { error: attendanceError } = await supabase.from("event_attendance").upsert({
        event_id: eventId,
        member_id: linkedMember.id,
        present: true,
        checked_by: user.id,
        checkin_method: "qr_code",
        checked_in_at: now,
      }, { onConflict: "event_id,member_id" });
      if (attendanceError) throw new Error(`Unable to save public.event_attendance: ${attendanceError.message}`);

      setState("success");
      setMessage("You have checked in successfully.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to check in.");
    }
  }

  const icon = state === "success"
    ? <CheckCircle2 className="h-8 w-8 text-emerald-700" />
    : state === "error"
      ? <XCircle className="h-8 w-8 text-rose-700" />
      : <Loader2 className="h-8 w-8 animate-spin text-churchblue" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeading title="Event Check-in" description="Hamburg Ghana SDA Church event attendance confirmation." />
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">{icon}</div>
        <h2 className="mt-5 text-2xl font-bold text-navy">{state === "success" ? "Checked In" : state === "error" ? "Check-in Needs Attention" : "Checking In"}</h2>
        <p className={`mt-3 text-sm font-semibold ${state === "error" ? "text-rose-700" : "text-slate-600"}`}>{message}</p>
        {event && <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-left">
          <p className="font-bold text-navy">{event.title}</p>
          <p className="mt-1 text-sm text-slate-500">{new Date(event.starts_at).toLocaleString("en-GB")}</p>
          <p className="mt-1 text-sm text-slate-500">{event.location || "Hamburg Ghana SDA Church"}</p>
        </div>}
        {member && <p className="mt-4 text-xs text-slate-400">Member: {member.full_name || member.member_number || member.id}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {state === "error" && <Button type="button" onClick={checkIn}><CalendarCheck className="h-4 w-4" /> Try Again</Button>}
          <Link href="/events"><Button type="button" variant="outline">Back to Events</Button></Link>
        </div>
      </Card>
    </div>
  );
}
