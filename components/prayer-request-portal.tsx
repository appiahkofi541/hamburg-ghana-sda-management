"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Eye, EyeOff, HeartHandshake, MessageCircleHeart, Plus,
  Search, Send, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import type { LucideIcon } from "lucide-react";

type PrayerStatus = "Submitted" | "Praying" | "Answered" | "Archived";
type TestimonyStatus = "Pending" | "Published" | "Archived";
type PrayerRequest = {
  id: string;
  title: string;
  requestText: string;
  isPublic: boolean;
  status: PrayerStatus;
  submitter: string;
  createdAt: string;
};
type Testimony = {
  id: string;
  prayerRequestId: string;
  title: string;
  testimonyText: string;
  isPublic: boolean;
  status: TestimonyStatus;
  submitter: string;
  createdAt: string;
};

const storageKey = "hamburg-ghana-sda-prayer-portal";
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const seedRequests: PrayerRequest[] = [
  { id: "1", title: "Strength for a new season", requestText: "Please pray for wisdom, peace, and strength as my family enters a new season.", isPublic: true, status: "Praying", submitter: "Church Member", createdAt: "2026-06-02" },
  { id: "2", title: "Healing and restoration", requestText: "Praying for healing and encouragement during recovery.", isPublic: true, status: "Answered", submitter: "Church Member", createdAt: "2026-05-28" },
];
const seedTestimonies: Testimony[] = [
  { id: "1", prayerRequestId: "2", title: "Thankful for answered prayer", testimonyText: "We are grateful for the support, prayer, and encouraging progress.", isPublic: true, status: "Published", submitter: "Church Member", createdAt: "2026-06-01" },
];
const summaryCards: [string, (requests: PrayerRequest[], testimonies: Testimony[]) => number, LucideIcon, string][] = [
  ["Prayer Requests", (requests) => requests.length, HeartHandshake, "bg-blue-50 text-churchblue"],
  ["Currently Praying", (requests) => requests.filter(({ status }) => status === "Praying").length, Sparkles, "bg-amber-50 text-amber-700"],
  ["Answered Prayers", (requests) => requests.filter(({ status }) => status === "Answered").length, CheckCircle2, "bg-emerald-50 text-emerald-700"],
  ["Testimonies", (_, testimonies) => testimonies.filter(({ status }) => status === "Published").length, MessageCircleHeart, "bg-purple-50 text-purple-700"],
];

const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const toSnake = (value: string) => value.toLowerCase().replaceAll(" ", "_");

export function PrayerRequestPortal() {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PrayerStatus | "All">("All");
  const [tab, setTab] = useState<"requests" | "testimonies">("requests");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showTestimonyForm, setShowTestimonyForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ title: "", requestText: "", isPublic: false });
  const [testimonyForm, setTestimonyForm] = useState({ prayerRequestId: "", title: "", testimonyText: "", isPublic: true });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(!createClient());

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          setCanManage((roleRows ?? []).some(({ role }) => role === "super_admin" || role === "pastor"));
        }
        const [{ data: prayerRows, error: prayerError }, { data: testimonyRows, error: testimonyError }] = await Promise.all([
          supabase.from("prayer_requests").select("*, profiles(full_name)").order("created_at", { ascending: false }),
          supabase.from("prayer_testimonies").select("*, profiles(full_name)").order("created_at", { ascending: false }),
        ]);
        if (prayerError || testimonyError) {
          setError(prayerError?.message ?? testimonyError?.message ?? "Unable to load prayer portal.");
        } else {
          setRequests((prayerRows ?? []).map((row) => ({
            id: row.id, title: row.title, requestText: row.request_text, isPublic: row.is_public,
            status: titleCase(row.status) as PrayerStatus, submitter: row.profiles?.full_name ?? "Church Member",
            createdAt: row.created_at.slice(0, 10),
          })));
          setTestimonies((testimonyRows ?? []).map((row) => ({
            id: row.id, prayerRequestId: row.prayer_request_id ?? "", title: row.title,
            testimonyText: row.testimony_text, isPublic: row.is_public,
            status: titleCase(row.status) as TestimonyStatus, submitter: row.profiles?.full_name ?? "Church Member",
            createdAt: row.created_at.slice(0, 10),
          })));
          setLoading(false);
          return;
        }
      }
      const stored = window.localStorage.getItem(storageKey);
      const preview = stored ? JSON.parse(stored) : { requests: seedRequests, testimonies: seedTestimonies };
      setRequests(preview.requests);
      setTestimonies(preview.testimonies);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!createClient() && !loading) window.localStorage.setItem(storageKey, JSON.stringify({ requests, testimonies }));
  }, [loading, requests, testimonies]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return requests.filter((request) => (filter === "All" || request.status === filter)
      && (!normalized || `${request.title} ${request.requestText} ${request.submitter}`.toLowerCase().includes(normalized)));
  }, [filter, query, requests]);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(requestForm.title, "Prayer request title") || required(requestForm.requestText, "Prayer request");
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    const supabase = createClient();
    let saved: PrayerRequest = { id: crypto.randomUUID(), ...requestForm, status: "Submitted", submitter: "You", createdAt: new Date().toISOString().slice(0, 10) };
    if (supabase) {
      const { data, error: saveError } = await supabase.from("prayer_requests").insert({ title: requestForm.title, request_text: requestForm.requestText, is_public: requestForm.isPublic }).select("id, created_at").single();
      if (saveError) { setError(saveError.message); setSaving(false); return; }
      saved = { ...saved, id: data.id, createdAt: data.created_at.slice(0, 10) };
    }
    setRequests((current) => [saved, ...current]);
    setRequestForm({ title: "", requestText: "", isPublic: false });
    setNotice("Prayer request submitted. Our church family is standing with you.");
    setError(""); setSaving(false); setShowRequestForm(false);
  }

  async function submitTestimony(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(testimonyForm.title, "Testimony title") || required(testimonyForm.testimonyText, "Testimony");
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    const supabase = createClient();
    let saved: Testimony = { id: crypto.randomUUID(), ...testimonyForm, status: "Pending", submitter: "You", createdAt: new Date().toISOString().slice(0, 10) };
    if (supabase) {
      const { data, error: saveError } = await supabase.from("prayer_testimonies").insert({ prayer_request_id: testimonyForm.prayerRequestId || null, title: testimonyForm.title, testimony_text: testimonyForm.testimonyText, is_public: testimonyForm.isPublic }).select("id, created_at").single();
      if (saveError) { setError(saveError.message); setSaving(false); return; }
      saved = { ...saved, id: data.id, createdAt: data.created_at.slice(0, 10) };
    }
    setTestimonies((current) => [saved, ...current]);
    setTestimonyForm({ prayerRequestId: "", title: "", testimonyText: "", isPublic: true });
    setNotice("Testimony submitted for pastoral review.");
    setError(""); setSaving(false); setShowTestimonyForm(false); setTab("testimonies");
  }

  async function updateRequestStatus(request: PrayerRequest, status: PrayerStatus) {
    const supabase = createClient();
    if (supabase) {
      const { error: updateError } = await supabase.from("prayer_requests").update({ status: toSnake(status) }).eq("id", request.id);
      if (updateError) { setError(updateError.message); return; }
    }
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status } : item));
    setNotice(`Prayer request marked ${status.toLowerCase()}.`);
  }

  async function updateTestimonyStatus(testimony: Testimony, status: TestimonyStatus) {
    const supabase = createClient();
    if (supabase) {
      const { error: updateError } = await supabase.from("prayer_testimonies").update({ status: toSnake(status) }).eq("id", testimony.id);
      if (updateError) { setError(updateError.message); return; }
    }
    setTestimonies((current) => current.map((item) => item.id === testimony.id ? { ...item, status } : item));
    setNotice(`Testimony marked ${status.toLowerCase()}.`);
  }

  return <div className="space-y-6">
    <PageHeading title="Prayer Request Portal" description="Share prayer needs, celebrate testimonies, and support our Hamburg Ghana SDA Church family." />
    {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
    {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map(([label, getValue, Icon, tone]) => <Card className="flex items-center gap-4 p-5" key={label}><div className={`rounded-lg p-3 ${tone}`}><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{getValue(requests, testimonies)}</p></div></Card>)}
    </section>
    <Card className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
      <div><h2 className="font-bold text-navy">{canManage ? "Pastor Dashboard" : "Prayer Ministry"}</h2><p className="mt-1 text-sm text-slate-500">{canManage ? "Review requests, guide prayer care, and publish testimonies." : "Your private requests are visible only to you and the pastoral team."}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowTestimonyForm(true)}><MessageCircleHeart className="h-4 w-4" /> Share Testimony</Button><Button onClick={() => setShowRequestForm(true)}><Plus className="h-4 w-4" /> Submit Request</Button></div>
    </Card>
    <div className="flex gap-2">{[["requests", "Prayer Requests"], ["testimonies", "Testimonies"]].map(([value, label]) => <Button key={value} variant={tab === value ? "default" : "outline"} onClick={() => setTab(value as typeof tab)}>{label}</Button>)}</div>
    {tab === "requests" ? <Card>
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 md:flex-row"><label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search prayer requests..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select className={fieldClass.replace("mt-1.5 ", "")} value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option>All</option>{["Submitted", "Praying", "Answered", "Archived"].map((status) => <option key={status}>{status}</option>)}</select></div>
      {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading prayer requests...</p> : <div className="grid gap-4 p-4 lg:grid-cols-2">{filtered.map((request) => <article className="rounded-xl border border-slate-100 p-5" key={request.id}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><StatusBadge tone={request.status === "Answered" ? "green" : request.status === "Praying" ? "gold" : "blue"}>{request.status}</StatusBadge><StatusBadge tone="slate">{request.isPublic ? <><Eye className="mr-1 h-3 w-3" /> Public</> : <><EyeOff className="mr-1 h-3 w-3" /> Private</>}</StatusBadge></div><span className="text-xs text-slate-400">{request.createdAt}</span></div><h3 className="mt-4 font-bold text-navy">{request.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{request.requestText}</p><p className="mt-4 text-xs font-semibold text-slate-400">Submitted by {request.submitter}</p>{canManage && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{(["Praying", "Answered", "Archived"] as PrayerStatus[]).map((status) => <Button key={status} size="sm" variant="outline" onClick={() => updateRequestStatus(request, status)}>{status}</Button>)}</div>}</article>)}</div>}
    </Card> : <div className="grid gap-4 lg:grid-cols-2">{testimonies.map((testimony) => <Card className="p-5" key={testimony.id}><div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge tone={testimony.status === "Published" ? "green" : "gold"}>{testimony.status}</StatusBadge><span className="text-xs text-slate-400">{testimony.createdAt}</span></div><h3 className="mt-4 font-bold text-navy">{testimony.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{testimony.testimonyText}</p><p className="mt-4 text-xs font-semibold text-slate-400">Shared by {testimony.submitter}</p>{canManage && testimony.status !== "Published" && <Button className="mt-4" size="sm" onClick={() => updateTestimonyStatus(testimony, "Published")}><Send className="h-4 w-4" /> Publish Testimony</Button>}</Card>)}</div>}
    {showRequestForm && <Modal title="Submit Prayer Request" onClose={() => setShowRequestForm(false)} onSubmit={submitRequest} saving={saving}><label className="text-sm font-semibold text-slate-700">Title<input className={fieldClass} value={requestForm.title} onChange={(event) => setRequestForm({ ...requestForm, title: event.target.value })} required /></label><label className="text-sm font-semibold text-slate-700">Prayer Request<textarea className="mt-1.5 min-h-32 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={requestForm.requestText} onChange={(event) => setRequestForm({ ...requestForm, requestText: event.target.value })} required /></label><PrivacyToggle checked={requestForm.isPublic} onChange={(isPublic) => setRequestForm({ ...requestForm, isPublic })} /></Modal>}
    {showTestimonyForm && <Modal title="Share Testimony" onClose={() => setShowTestimonyForm(false)} onSubmit={submitTestimony} saving={saving}><label className="text-sm font-semibold text-slate-700">Related Prayer Request<select className={fieldClass} value={testimonyForm.prayerRequestId} onChange={(event) => setTestimonyForm({ ...testimonyForm, prayerRequestId: event.target.value })}><option value="">General testimony</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.title}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Title<input className={fieldClass} value={testimonyForm.title} onChange={(event) => setTestimonyForm({ ...testimonyForm, title: event.target.value })} required /></label><label className="text-sm font-semibold text-slate-700">Testimony<textarea className="mt-1.5 min-h-32 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={testimonyForm.testimonyText} onChange={(event) => setTestimonyForm({ ...testimonyForm, testimonyText: event.target.value })} required /></label><PrivacyToggle checked={testimonyForm.isPublic} onChange={(isPublic) => setTestimonyForm({ ...testimonyForm, isPublic })} /></Modal>}
  </div>;
}

function PrivacyToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"><input className="mt-1 accent-churchblue" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><strong className="block text-navy">Share with church family</strong><span className="text-xs text-slate-500">{checked ? "Visible to authenticated church members." : "Private: visible only to you and the pastoral team."}</span></span></label>;
}

function Modal({ title, children, onClose, onSubmit, saving }: { title: string; children: React.ReactNode; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="w-full max-w-xl rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church prayer ministry</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="space-y-4 p-5">{children}</div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit"><ShieldCheck className="h-4 w-4" /> {saving ? "Saving..." : "Submit"}</Button></div></form></div>;
}
