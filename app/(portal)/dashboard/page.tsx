"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, CircleDollarSign, ClipboardCheck, HeartHandshake, IdCard, Library, Megaphone, ReceiptText, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { events } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/status-badge";
import { useT } from "@/components/language-provider";
import { MemberAvatar } from "@/components/member-avatar";

const attendance = [68, 74, 62, 78, 72, 83, 76, 88, 80, 91, 86, 94];
const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const previewTotals = { members: 486, attendance: 298, offerings: currency.format(12480), events: 12 };

export default function DashboardPage() {
  const t = useT();
  const [totals, setTotals] = useState(previewTotals);
  const [memberPhoto, setMemberPhoto] = useState("");
  const [memberName, setMemberName] = useState("Church Member");
  const [memberStats, setMemberStats] = useState({ unreadAnnouncements: 0, givingTotal: "€0", prayerRequests: 0, eventRegistrations: 0 });

  useEffect(() => {
    async function loadTotals() {
      const supabase = createClient();
      if (!supabase) return;

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const inThirtyDays = new Date(today.getTime() + 30 * 86400000).toISOString();
      const [{ count: memberCount }, { data: latestAttendance }, { count: eventCount }, { data: { user } }] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("attendance_sessions").select("adult_count, child_count, visitor_count").order("service_date", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("starts_at", today.toISOString()).lte("starts_at", inThirtyDays),
        supabase.auth.getUser(),
      ]);

      let offerings = "Restricted";
      if (user) {
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const canViewFinance = (roleRows ?? []).some(({ role }) => ["super_admin", "pastor", "elder", "treasurer"].includes(role));
        if (canViewFinance) {
          const { data: contributions } = await supabase.from("finance_transactions").select("amount").gte("transaction_date", monthStart);
          offerings = currency.format((contributions ?? []).reduce((sum, { amount }) => sum + Number(amount), 0));
        }
        const { data: member } = await supabase.from("members").select("id, full_name, photo_thumbnail_url, photo_url").eq("profile_id", user.id).maybeSingle();
        if (member) {
          setMemberName(member.full_name ?? "Church Member");
          setMemberPhoto(member.photo_thumbnail_url ?? member.photo_url ?? "");
          const [{ count: announcementCount }, { data: reads }, { data: givingRows }, { count: prayerCount }, { count: registrationCount }] = await Promise.all([
            supabase.from("communication_announcements").select("id", { count: "exact", head: true }).in("status", ["published", "scheduled"]),
            supabase.from("member_announcement_reads").select("announcement_id").eq("member_id", member.id),
            supabase.from("finance_transactions").select("amount").eq("member_id", member.id),
            supabase.from("prayer_requests").select("id", { count: "exact", head: true }).eq("submitted_by", user.id),
            supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("member_id", member.id),
          ]);
          setMemberStats({
            unreadAnnouncements: Math.max((announcementCount ?? 0) - (reads?.length ?? 0), 0),
            givingTotal: currency.format((givingRows ?? []).reduce((sum, row) => sum + Number(row.amount), 0)),
            prayerRequests: prayerCount ?? 0,
            eventRegistrations: registrationCount ?? 0,
          });
        }
      }

      setTotals({
        members: memberCount ?? 0,
        attendance: latestAttendance ? latestAttendance.adult_count + latestAttendance.child_count + latestAttendance.visitor_count : 0,
        offerings,
        events: eventCount ?? 0,
      });
    }
    loadTotals();
  }, []);

  const cards = [
    { label: t("dashboard.totalMembers"), value: String(totals.members), note: "Current membership records", icon: Users, tone: "bg-blue-50 text-churchblue" },
    { label: t("dashboard.totalAttendance"), value: String(totals.attendance), note: "Latest recorded service", icon: ClipboardCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: t("dashboard.monthlyOfferings"), value: totals.offerings, note: "Current calendar month", icon: CircleDollarSign, tone: "bg-amber-50 text-amber-700" },
    { label: t("dashboard.upcomingEvents"), value: String(totals.events), note: "Next 30 days", icon: CalendarDays, tone: "bg-purple-50 text-purple-700" },
  ];
  const memberDashboard = [
    [t("nav.myProfile"), "/my-profile", IdCard],
    [t("nav.myAttendance"), "/my-attendance", ClipboardCheck],
    [t("nav.myContributions"), "/my-contributions", ReceiptText],
    [t("nav.prayerRequests"), "/prayer-requests", HeartHandshake],
    [t("nav.events"), "/events", CalendarDays],
    [t("nav.announcements"), "/announcements", Megaphone],
    [t("nav.sermons"), "/sermons", Library],
  ] as const;
  const selfServiceWidgets: { label: string; value: string; href: string; icon: LucideIcon }[] = [
    { label: "Unread Announcements", value: String(memberStats.unreadAnnouncements), href: "/announcements", icon: Megaphone },
    { label: "My Giving Total", value: memberStats.givingTotal, href: "/my-contributions", icon: ReceiptText },
    { label: "Prayer Requests", value: String(memberStats.prayerRequests), href: "/prayer-requests", icon: HeartHandshake },
    { label: "Event Registrations", value: String(memberStats.eventRegistrations), href: "/events", icon: CalendarDays },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <MemberAvatar alt={memberName} size="md" src={memberPhoto} />
        <div>
          <p className="text-sm font-semibold text-gold">{new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-2xl font-bold text-navy sm:text-3xl">{t("dashboard.welcome")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("dashboard.description")}</p>
        </div>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-navy">{value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-400">{note}</p>
          </Card>
        ))}
      </section>
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Bell className="h-5 w-5" /></div>
          <div>
            <h2 className="font-bold text-navy">Member Dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">Quick access to your member tools and church life updates.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {memberDashboard.map(([label, href, Icon]) => <Link className="rounded-lg border border-slate-100 p-4 transition hover:border-churchblue/30 hover:shadow-card" href={href} key={href}><Icon className="h-5 w-5 text-churchblue" /><p className="mt-3 text-sm font-bold text-navy">{label}</p></Link>)}
        </div>
      </Card>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {selfServiceWidgets.map(({ label, value, href, icon: Icon }) => (
          <Link href={href} key={label}>
            <Card className="flex items-center justify-between p-5 transition hover:border-churchblue/30 hover:shadow-lg">
              <div><p className="text-sm font-semibold text-navy">{label}</p><p className="mt-1 text-xl font-bold text-churchblue">{value}</p></div>
              <Icon className="h-6 w-6 text-churchblue" />
            </Card>
          </Link>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold text-navy">Attendance Overview</h2>
              <p className="mt-1 text-xs text-slate-400">Weekly worship attendance for the last 12 weeks</p>
            </div>
            <StatusBadge tone="blue">Last 12 weeks</StatusBadge>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-3 border-b border-slate-100 pt-4">
              {attendance.map((height, index) => (
                <div className="flex h-full flex-1 items-end" key={index}>
                  <div className="w-full rounded-t bg-churchblue/80 transition-colors hover:bg-churchblue" style={{ height: `${height}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-slate-400"><span>MAR</span><span>APR</span><span>MAY</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold text-navy">Upcoming Events</h2>
              <p className="mt-1 text-xs text-slate-400">Church activities on the calendar</p>
            </div>
            <Link href="/events" className="text-xs font-bold text-churchblue">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.slice(0, 3).map((event) => (
              <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3" key={event.title}>
                <div className="w-11 rounded-lg bg-blue-50 py-1.5 text-center">
                  <p className="text-[10px] font-bold text-churchblue">{event.month}</p>
                  <p className="text-base font-bold text-navy">{event.date}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{event.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-6 md:grid-cols-4">
        {[
          ["Member Growth", "+14.2%", "Compared to last year"],
          ["Giving Progress", "82%", "Monthly goal reached"],
          ["Active Departments", "12", "Across all ministries"],
        ].map(([label, value, note]) => (
          <Card className="flex items-center justify-between p-5" key={label}>
            <div><p className="text-sm font-semibold text-navy">{label}</p><p className="mt-1 text-xs text-slate-400">{note}</p></div>
            <p className="text-xl font-bold text-churchblue">{value}</p>
          </Card>
        ))}
        <Link href="/giving-history">
          <Card className="flex h-full items-center justify-between p-5 transition hover:border-churchblue/30 hover:shadow-lg">
            <div><p className="text-sm font-semibold text-navy">Giving History</p><p className="mt-1 text-xs text-slate-400">Download your contribution statement</p></div>
            <ReceiptText className="h-6 w-6 text-churchblue" />
          </Card>
        </Link>
      </section>
    </div>
  );
}
