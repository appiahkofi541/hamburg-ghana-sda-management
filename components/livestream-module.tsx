"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock, ExternalLink, PlayCircle, Plus, RadioTower,
  Settings2, Trash2, Video, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type StreamStatus = "scheduled" | "live" | "completed" | "cancelled";
type Stream = {
  id: string; title: string; description: string; youtubeUrl: string;
  youtubeEmbedUrl: string; startsAt: string; endsAt: string | null; status: StreamStatus;
};
type RecentSermon = { id: string; title: string; speaker: string; sermonDate: string; mediaUrl: string };
type Channel = { name: string; url: string };

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const statuses: StreamStatus[] = ["scheduled", "live", "completed", "cancelled"];
const emptyStream = { title: "", description: "", youtubeUrl: "", startsAt: "", endsAt: "", status: "scheduled" as StreamStatus };
const pretty = (value: string) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value));

function getYoutubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace("www.", "");
    if (hostname === "youtu.be") return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    if (!["youtube.com", "m.youtube.com"].includes(hostname)) return null;
    const id = url.searchParams.get("v") || url.pathname.match(/^\/(?:live|embed|shorts)\/([^/?]+)/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export function LivestreamModule() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [sermons, setSermons] = useState<RecentSermon[]>([]);
  const [channel, setChannel] = useState<Channel>({ name: "Hamburg Ghana SDA Church", url: "" });
  const [streamForm, setStreamForm] = useState(emptyStream);
  const [channelForm, setChannelForm] = useState(channel);
  const [showStreamForm, setShowStreamForm] = useState(false);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const supabase = createClient();
    if (!supabase) { setError("Supabase is not configured. Add the project URL and anonymous key to use livestreams."); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setCanManage((roles ?? []).some(({ role }) => ["super_admin", "pastor", "church_clerk"].includes(role)));
    }
    const [{ data: settings, error: settingsError }, { data: streamRows, error: streamError }, { data: sermonRows, error: sermonError }] = await Promise.all([
      supabase.from("livestream_settings").select("*").eq("id", "church").single(),
      supabase.from("livestreams").select("*").order("starts_at", { ascending: false }),
      supabase.from("sermons").select("id, title, speaker, sermon_date, media_url").eq("media_type", "video").eq("status", "published").order("sermon_date", { ascending: false }).limit(6),
    ]);
    if (settingsError || streamError || sermonError) setError(settingsError?.message ?? streamError?.message ?? sermonError?.message ?? "Unable to load livestreams.");
    else {
      const nextChannel = { name: settings.youtube_channel_name, url: settings.youtube_channel_url ?? "" };
      setChannel(nextChannel); setChannelForm(nextChannel);
      setStreams((streamRows ?? []).map((row) => ({ id: row.id, title: row.title, description: row.description ?? "", youtubeUrl: row.youtube_url, youtubeEmbedUrl: row.youtube_embed_url, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status })));
      setSermons((sermonRows ?? []).map((row) => ({ id: row.id, title: row.title, speaker: row.speaker ?? "Hamburg Ghana SDA Church", sermonDate: row.sermon_date, mediaUrl: row.media_url })));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const live = useMemo(() => streams.find(({ status }) => status === "live"), [streams]);
  const upcoming = useMemo(() => streams.filter(({ status, startsAt }) => status === "scheduled" && new Date(startsAt) >= new Date()).sort((left, right) => left.startsAt.localeCompare(right.startsAt)), [streams]);

  async function saveStream(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(streamForm.title, "Title") || required(streamForm.youtubeUrl, "YouTube URL") || required(streamForm.startsAt, "Start time");
    if (validationError) { setError(validationError); return; }
    const embedUrl = getYoutubeEmbedUrl(streamForm.youtubeUrl);
    if (!embedUrl) { setError("Use a valid YouTube video or livestream URL."); return; }
    const supabase = createClient(); if (!supabase) return;
    setSaving(true); setError("");
    const { error: saveError } = await supabase.from("livestreams").insert({
      title: streamForm.title, description: streamForm.description || null,
      youtube_url: streamForm.youtubeUrl, youtube_embed_url: embedUrl,
      starts_at: new Date(streamForm.startsAt).toISOString(),
      ends_at: streamForm.endsAt ? new Date(streamForm.endsAt).toISOString() : null,
      status: streamForm.status,
    });
    if (saveError) setError(saveError.message);
    else { setNotice("Livestream added."); setStreamForm(emptyStream); setShowStreamForm(false); await load(); }
    setSaving(false);
  }

  async function saveChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(channelForm.name, "Channel name");
    if (validationError) { setError(validationError); return; }
    if (channelForm.url) { try { new URL(channelForm.url); } catch { setError("Channel URL must be a complete web address."); return; } }
    const supabase = createClient(); if (!supabase) return;
    setSaving(true); setError("");
    const { error: saveError } = await supabase.from("livestream_settings").update({ youtube_channel_name: channelForm.name, youtube_channel_url: channelForm.url || null }).eq("id", "church");
    if (saveError) setError(saveError.message);
    else { setChannel(channelForm); setNotice("YouTube channel updated."); setShowChannelForm(false); }
    setSaving(false);
  }

  async function updateStatus(stream: Stream, status: StreamStatus) {
    const supabase = createClient(); if (!supabase) return;
    const { error: updateError } = await supabase.from("livestreams").update({ status }).eq("id", stream.id);
    if (updateError) setError(updateError.message);
    else { setStreams((current) => current.map((item) => item.id === stream.id ? { ...item, status } : item)); setNotice(`Livestream marked ${status}.`); }
  }

  async function deleteStream(stream: Stream) {
    if (!window.confirm(`Delete "${stream.title}"?`)) return;
    const supabase = createClient(); if (!supabase) return;
    const { error: deleteError } = await supabase.from("livestreams").delete().eq("id", stream.id);
    if (deleteError) setError(deleteError.message);
    else { setStreams((current) => current.filter(({ id }) => id !== stream.id)); setNotice("Livestream deleted."); }
  }

  return <div className="space-y-6">
    <PageHeading title="Livestream" description="Join services online and revisit recent messages from Hamburg Ghana SDA Church." />
    {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
    {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <Card className="overflow-hidden">
      {live ? <><div className="aspect-video bg-slate-950"><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" src={live.youtubeEmbedUrl} title={live.title} /></div><div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><StatusBadge tone="red">Live Now</StatusBadge><span className="text-xs text-slate-400">{formatDate(live.startsAt)}</span></div><h2 className="mt-3 text-xl font-bold text-navy">{live.title}</h2><p className="mt-1 text-sm text-slate-500">{live.description}</p></div><a className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-churchblue px-4 text-sm font-semibold text-white hover:bg-navy" href={live.youtubeUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /> Watch on YouTube</a></div></> : <div className="flex min-h-72 flex-col items-center justify-center bg-gradient-to-br from-navy-deep to-churchblue p-8 text-center text-white"><RadioTower className="h-11 w-11 text-gold" /><p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Hamburg Ghana SDA Church</p><h2 className="mt-2 text-2xl font-bold">No livestream is active right now</h2><p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">Check the upcoming schedule below or visit our YouTube channel for worship services and recent messages.</p>{channel.url && <a className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-bold text-navy-deep hover:bg-white" href={channel.url} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /> Visit {channel.name}</a>}</div>}
    </Card>
    {canManage && <Card className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><h2 className="font-bold text-navy">Livestream Management</h2><p className="mt-1 text-sm text-slate-500">Configure the church channel and publish scheduled or active broadcasts.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowChannelForm(true)}><Settings2 className="h-4 w-4" /> Configure Channel</Button><Button onClick={() => setShowStreamForm(true)}><Plus className="h-4 w-4" /> Add Livestream</Button></div></Card>}
    <section><div className="mb-3 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-churchblue" /><h2 className="text-lg font-bold text-navy">Upcoming Livestreams</h2></div>{loading ? <Card className="p-8 text-center text-sm text-slate-500">Loading livestream schedule...</Card> : upcoming.length === 0 ? <Card className="p-8 text-center text-sm text-slate-500">No upcoming livestreams have been scheduled.</Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{upcoming.map((stream) => <StreamCard canManage={canManage} key={stream.id} onDelete={deleteStream} onStatus={updateStatus} stream={stream} />)}</div>}</section>
    {canManage && streams.filter(({ status }) => status === "completed" || status === "cancelled").length > 0 && <section><h2 className="mb-3 text-lg font-bold text-navy">Managed Broadcasts</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{streams.filter(({ status }) => status === "completed" || status === "cancelled").map((stream) => <StreamCard canManage key={stream.id} onDelete={deleteStream} onStatus={updateStatus} stream={stream} />)}</div></section>}
    <section><div className="mb-3 flex items-center gap-2"><Video className="h-5 w-5 text-churchblue" /><h2 className="text-lg font-bold text-navy">Recent Sermons</h2></div>{loading ? <Card className="p-8 text-center text-sm text-slate-500">Loading recent sermons...</Card> : sermons.length === 0 ? <Card className="p-8 text-center text-sm text-slate-500">Recent video sermons will appear here after they are published in the Sermon Archive.</Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sermons.map((sermon) => <Card className="p-5" key={sermon.id}><PlayCircle className="h-8 w-8 text-churchblue" /><h3 className="mt-4 font-bold text-navy">{sermon.title}</h3><p className="mt-2 text-xs text-slate-400">{sermon.speaker} · {sermon.sermonDate}</p><a className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-churchblue hover:text-navy" href={sermon.mediaUrl} rel="noreferrer" target="_blank">Watch sermon <ExternalLink className="h-3.5 w-3.5" /></a></Card>)}</div>}</section>
    {showStreamForm && <StreamModal form={streamForm} saving={saving} onClose={() => setShowStreamForm(false)} onForm={setStreamForm} onSubmit={saveStream} />}
    {showChannelForm && <ChannelModal form={channelForm} saving={saving} onClose={() => setShowChannelForm(false)} onForm={setChannelForm} onSubmit={saveChannel} />}
  </div>;
}

function StreamCard({ stream, canManage, onStatus, onDelete }: { stream: Stream; canManage: boolean; onStatus: (stream: Stream, status: StreamStatus) => void; onDelete: (stream: Stream) => void }) {
  return <Card className="flex flex-col p-5"><div className="flex items-start justify-between gap-3"><RadioTower className="h-6 w-6 text-churchblue" /><StatusBadge tone={stream.status === "live" ? "red" : stream.status === "completed" ? "green" : "gold"}>{pretty(stream.status)}</StatusBadge></div><h3 className="mt-4 font-bold text-navy">{stream.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{stream.description || "Hamburg Ghana SDA Church online service."}</p><p className="mt-4 text-xs font-semibold text-slate-400">{formatDate(stream.startsAt)}</p><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><a className="inline-flex h-9 items-center gap-2 rounded-lg bg-churchblue px-3 text-sm font-semibold text-white hover:bg-navy" href={stream.youtubeUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /> YouTube</a>{canManage && <select aria-label={`Set status for ${stream.title}`} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600" value={stream.status} onChange={(event) => onStatus(stream, event.target.value as StreamStatus)}>{statuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select>}{canManage && <Button aria-label={`Delete ${stream.title}`} size="icon" variant="ghost" onClick={() => onDelete(stream)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}</div></Card>;
}

function StreamModal({ form, saving, onClose, onForm, onSubmit }: { form: typeof emptyStream; saving: boolean; onClose: () => void; onForm: (form: typeof emptyStream) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Add Livestream" saving={saving} onClose={onClose} onSubmit={onSubmit}><label className="text-sm font-semibold text-slate-700">Title<input className={fieldClass} required value={form.title} onChange={(event) => onForm({ ...form, title: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">YouTube video or livestream URL<input className={fieldClass} required placeholder="https://www.youtube.com/watch?v=..." type="url" value={form.youtubeUrl} onChange={(event) => onForm({ ...form, youtubeUrl: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Start time<input className={fieldClass} required type="datetime-local" value={form.startsAt} onChange={(event) => onForm({ ...form, startsAt: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">End time<input className={fieldClass} type="datetime-local" value={form.endsAt} onChange={(event) => onForm({ ...form, endsAt: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Status<select className={fieldClass} value={form.status} onChange={(event) => onForm({ ...form, status: event.target.value as StreamStatus })}>{statuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Description<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.description} onChange={(event) => onForm({ ...form, description: event.target.value })} /></label></Modal>;
}

function ChannelModal({ form, saving, onClose, onForm, onSubmit }: { form: Channel; saving: boolean; onClose: () => void; onForm: (form: Channel) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Configure YouTube Channel" saving={saving} onClose={onClose} onSubmit={onSubmit}><label className="text-sm font-semibold text-slate-700">Channel name<input className={fieldClass} required value={form.name} onChange={(event) => onForm({ ...form, name: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Church YouTube channel URL<input className={fieldClass} placeholder="https://www.youtube.com/@your-channel" type="url" value={form.url} onChange={(event) => onForm({ ...form, url: event.target.value })} /></label></Modal>;
}

function Modal({ title, children, saving, onClose, onSubmit }: { title: string; children: React.ReactNode; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church livestream ministry</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="space-y-4 p-5">{children}</div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit"><RadioTower className="h-4 w-4" /> {saving ? "Saving..." : "Save"}</Button></div></form></div>;
}
