"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Megaphone, Pin, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { announcements as previewAnnouncements } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  date: string;
  expiresAt: string;
  isRead: boolean;
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [memberId, setMemberId] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        setItems(previewAnnouncements.map((item, index) => ({ id: String(index), title: item.title, body: item.body, audience: item.audience, date: item.date, expiresAt: "", isRead: false })));
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: member } = user ? await supabase.from("members").select("id").eq("profile_id", user.id).maybeSingle() : { data: null };
      if (member?.id) setMemberId(member.id);
      const [{ data: rows, error: announcementError }, { data: reads }] = await Promise.all([
        supabase.from("communication_announcements").select("*").in("status", ["published", "scheduled"]).order("scheduled_at", { ascending: false }),
        member?.id ? supabase.from("member_announcement_reads").select("announcement_id").eq("member_id", member.id) : Promise.resolve({ data: [] }),
      ]);

      if (announcementError) {
        setError(`${announcementError.message}. Apply migration 202606080002_communication_module.sql and 202606080003_member_self_service_portal.sql in Supabase.`);
        setItems(previewAnnouncements.map((item, index) => ({ id: String(index), title: item.title, body: item.body, audience: item.audience, date: item.date, expiresAt: "", isRead: false })));
      } else {
        const readIds = new Set((reads ?? []).map((read) => read.announcement_id));
        setItems((rows ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          audience: label(row.target_audience),
          date: row.scheduled_at?.slice(0, 10) ?? row.created_at.slice(0, 10),
          expiresAt: row.expires_at?.slice(0, 10) ?? "",
          isRead: readIds.has(row.id),
        })));
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => !needle || `${item.title} ${item.body} ${item.audience}`.toLowerCase().includes(needle));
  }, [items, query]);
  const unread = items.filter((item) => !item.isRead).length;

  async function markRead(announcement: Announcement) {
    if (announcement.isRead) return;
    const supabase = createClient();
    if (supabase && memberId) {
      const { error: saveError } = await supabase.from("member_announcement_reads").upsert({ member_id: memberId, announcement_id: announcement.id }, { onConflict: "member_id,announcement_id" });
      if (saveError) { setError(saveError.message); return; }
    }
    setItems((current) => current.map((item) => item.id === announcement.id ? { ...item, isRead: true } : item));
    setNotice("Announcement marked as read.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <PageHeading title="Announcements Feed" description="Church updates for Hamburg Ghana SDA Church with read and unread tracking." />
        <StatusBadge tone={unread ? "gold" : "green"}>{unread} unread</StatusBadge>
      </div>
      {notice && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <Card className="p-4">
        <label className="flex h-10 max-w-xl items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search announcements..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </Card>
      <div className="space-y-4">
        {loading && <Card className="p-8 text-center text-sm text-slate-500">Loading announcements...</Card>}
        {filtered.map((announcement, index) => (
          <Card className={`p-5 ${announcement.isRead ? "" : "border-churchblue/30 bg-blue-50/40"}`} key={announcement.id}>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">{index === 0 ? <Pin className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}</div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="font-bold text-navy">{announcement.title}</h2><p className="mt-1 text-xs text-slate-400">{announcement.date}{announcement.expiresAt ? ` · Expires ${announcement.expiresAt}` : ""}</p></div>
                  <div className="flex flex-wrap gap-2"><StatusBadge tone="blue">{announcement.audience}</StatusBadge><StatusBadge tone={announcement.isRead ? "green" : "gold"}>{announcement.isRead ? "Read" : "Unread"}</StatusBadge></div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{announcement.body}</p>
                {!announcement.isRead && <Button className="mt-4" size="sm" variant="outline" onClick={() => markRead(announcement)}><CheckCircle2 className="h-4 w-4" /> Mark as Read</Button>}
              </div>
            </div>
          </Card>
        ))}
        {!loading && filtered.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">No announcements found.</Card>}
      </div>
    </div>
  );
}
