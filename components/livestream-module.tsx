"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock, Edit3, ExternalLink, PlayCircle, Plus, RadioTower,
  Settings2, Square, Trash2, Video, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles } from "@/lib/auth";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type StreamStatus = "scheduled" | "live" | "completed" | "cancelled";
type StreamSource = "youtube" | "facebook" | "custom";
type Stream = {
  id: string;
  title: string;
  description: string;
  source: StreamSource;
  watchUrl: string;
  embedUrl: string;
  startsAt: string;
  endsAt: string | null;
  status: StreamStatus;
};
type RecentSermon = { id: string; title: string; speaker: string; sermonDate: string; mediaUrl: string };
type Channel = { name: string; url: string };
type StreamForm = Omit<Stream, "id" | "watchUrl" | "embedUrl"> & { url: string };

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const textareaClass = "mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue";
const statuses: StreamStatus[] = ["scheduled", "live", "completed", "cancelled"];
const emptyStream: StreamForm = { title: "", description: "", source: "youtube", url: "", startsAt: "", endsAt: "", status: "scheduled" };
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value));

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

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

function resolveEmbedUrl(source: StreamSource, value: string) {
  try {
    const url = new URL(value);
    if (source === "youtube") return getYoutubeEmbedUrl(value);
    if (source === "facebook") return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.toString())}&show_text=false&width=1280`;
    return url.toString();
  } catch {
    return null;
  }
}

function inferSource(watchUrl: string, embedUrl: string): StreamSource {
  const combined = `${watchUrl} ${embedUrl}`.toLowerCase();
  if (combined.includes("facebook.com")) return "facebook";
  if (combined.includes("youtube.com") || combined.includes("youtu.be")) return "youtube";
  return "custom";
}

function isCurrentlyActive(stream: Stream) {
  const now = Date.now();
  const starts = new Date(stream.startsAt).getTime();
  const ends = stream.endsAt ? new Date(stream.endsAt).getTime() : Number.POSITIVE_INFINITY;
  return stream.status === "live" || (stream.status === "scheduled" && starts <= now && now <= ends);
}

export function LivestreamModule() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [sermons, setSermons] = useState<RecentSermon[]>([]);
  const [channel, setChannel] = useState<Channel>({ name: "Hamburg Ghana SDA Church", url: "" });
  const [streamForm, setStreamForm] = useState<StreamForm>(emptyStream);
  const [channelForm, setChannelForm] = useState(channel);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
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
      const normalized = normalizeRoles((roles ?? []).map(({ role }) => role));
      setCanManage(normalized.includes("super_admin"));
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
      setStreams((streamRows ?? []).map((row) => {
        const watchUrl = row.youtube_url;
        const embedUrl = row.youtube_embed_url;
        return { id: row.id, title: row.title, description: row.description ?? "", source: inferSource(watchUrl, embedUrl), watchUrl, embedUrl, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status };
      }));
      setSermons((sermonRows ?? []).map((row) => ({ id: row.id, title: row.title, speaker: row.speaker ?? "Hamburg Ghana SDA Church", sermonDate: row.sermon_date, mediaUrl: row.media_url })));
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const live = useMemo(() => streams.filter(isCurrentlyActive).sort((left, right) => right.startsAt.localeCompare(left.startsAt))[0], [streams]);
  const upcoming = useMemo(() => streams.filter(({ status, startsAt }) => status === "scheduled" && new Date(startsAt) >= new Date()).sort((left, right) => left.startsAt.localeCompare(right.startsAt)), [streams]);
  const managed = useMemo(() => streams.filter((stream) => stream.status !== "scheduled" || new Date(stream.startsAt) < new Date()), [streams]);

  function openCreate(status: StreamStatus) {
    setEditingStream(null);
    setStreamForm({ ...emptyStream, status });
    setError("");
    setShowStreamForm(true);
  }

  function openEdit(stream: Stream) {
    setEditingStream(stream);
    setStreamForm({ title: stream.title, description: stream.description, source: stream.source, url: stream.watchUrl, startsAt: toLocalDateTime(stream.startsAt), endsAt: toLocalDateTime(stream.endsAt), status: stream.status });
    setError("");
    setShowStreamForm(true);
  }

  async function saveStream(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) { setError("Only Super Admin can create or manage livestreams."); return; }
    const validationError = required(streamForm.title, "Title") || required(streamForm.url, `${pretty(streamForm.source)} URL`) || required(streamForm.startsAt, "Start time");
    if (validationError) { setError(validationError); return; }
    const embedUrl = resolveEmbedUrl(streamForm.source, streamForm.url);
    if (!embedUrl) { setError(`Use a valid ${pretty(streamForm.source)} URL.`); return; }
    const supabase = createClient(); if (!supabase) return;
    setSaving(true); setError("");
    const payload = {
      title: streamForm.title,
      description: streamForm.description || null,
      youtube_url: streamForm.url,
      youtube_embed_url: embedUrl,
      starts_at: new Date(streamForm.startsAt).toISOString(),
      ends_at: streamForm.endsAt ? new Date(streamForm.endsAt).toISOString() : null,
      status: streamForm.status,
    };
    const request = editingStream ? supabase.from("livestreams").update(payload).eq("id", editingStream.id) : supabase.from("livestreams").insert(payload);
    const { error: saveError } = await request;
    if (saveError) setError(saveError.message);
    else {
      setNotice(editingStream ? "Livestream updated." : streamForm.status === "live" ? "Livestream created and marked live." : "Livestream scheduled.");
      setStreamForm(emptyStream); setEditingStream(null); setShowStreamForm(false); await load();
    }
    setSaving(false);
  }

  async function saveChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) { setError("Only Super Admin can configure livestream channels."); return; }
    const validationError = required(channelForm.name, "Channel name");
    if (validationError) { setError(validationError); return; }
    if (channelForm.url) { try { new URL(channelForm.url); } catch { setError("Channel URL must be a complete web address."); return; } }
    const supabase = createClient(); if (!supabase) return;
    setSaving(true); setError("");
    const { error: saveError } = await supabase.from("livestream_settings").update({ youtube_channel_name: channelForm.name, youtube_channel_url: channelForm.url || null }).eq("id", "church");
    if (saveError) setError(saveError.message);
    else { setChannel(channelForm); setNotice("Livestream channel updated."); setShowChannelForm(false); }
    setSaving(false);
  }

  async function updateStatus(stream: Stream, status: StreamStatus) {
    if (!canManage) return;
    const supabase = createClient(); if (!supabase) return;
    const { error: updateError } = await supabase.from("livestreams").update({ status, ends_at: status === "completed" ? new Date().toISOString() : stream.endsAt }).eq("id", stream.id);
    if (updateError) setError(updateError.message);
    else { setStreams((current) => current.map((item) => item.id === stream.id ? { ...item, status, endsAt: status === "completed" ? new Date().toISOString() : item.endsAt } : item)); setNotice(`Livestream marked ${pretty(status)}.`); }
  }

  async function deleteStream(stream: Stream) {
    if (!canManage) return;
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
      {live ? <><div className="aspect-video bg-slate-950"><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="h-full w-full" src={live.embedUrl} title={live.title} /></div><div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><StatusBadge tone="red">Live Now</StatusBadge><StatusBadge tone="blue">{pretty(live.source)}</StatusBadge><span className="text-xs text-slate-400">{formatDate(live.startsAt)}</span></div><h2 className="mt-3 text-xl font-bold text-navy">{live.title}</h2><p className="mt-1 text-sm text-slate-500">{live.description}</p></div><a className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-churchblue px-4 text-sm font-semibold text-white hover:bg-navy" href={live.watchUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /> Watch externally</a></div></> : <div className="flex min-h-72 flex-col items-center justify-center bg-gradient-to-br from-navy-deep to-churchblue p-8 text-center text-white"><RadioTower className="h-11 w-11 text-gold" /><p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Hamburg Ghana SDA Church</p><h2 className="mt-2 text-2xl font-bold">No livestream is active right now</h2><p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">Check the upcoming schedule below or visit our online channel for worship services and recent messages.</p>{channel.url && <a className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-bold text-navy-deep hover:bg-white" href={channel.url} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /> Visit {channel.name}</a>}</div>}
    </Card>
    {canManage && <Card className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><h2 className="font-bold text-navy">Super Admin Livestream Controls</h2><p className="mt-1 text-sm text-slate-500">Create, schedule, edit, and end YouTube, Facebook, or custom embedded broadcasts.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowChannelForm(true)}><Settings2 className="h-4 w-4" /> Configure Channel</Button><Button variant="outline" onClick={() => openCreate("scheduled")}><CalendarClock className="h-4 w-4" /> Schedule Livestream</Button><Button onClick={() => openCreate("live")}><Plus className="h-4 w-4" /> Create Livestream</Button></div></Card>}
    <section><div className="mb-3 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-churchblue" /><h2 className="text-lg font-bold text-navy">Upcoming Livestreams</h2></div>{loading ? <Card className="p-8 text-center text-sm text-slate-500">Loading livestream schedule...</Card> : upcoming.length === 0 ? <Card className="p-8 text-center text-sm text-slate-500">No upcoming livestreams have been scheduled.</Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{upcoming.map((stream) => <StreamCard canManage={canManage} key={stream.id} onDelete={deleteStream} onEdit={openEdit} onStatus={updateStatus} stream={stream} />)}</div>}</section>
    {canManage && managed.length > 0 && <section><h2 className="mb-3 text-lg font-bold text-navy">Managed Broadcasts</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{managed.map((stream) => <StreamCard canManage key={stream.id} onDelete={deleteStream} onEdit={openEdit} onStatus={updateStatus} stream={stream} />)}</div></section>}
    <section><div className="mb-3 flex items-center gap-2"><Video className="h-5 w-5 text-churchblue" /><h2 className="text-lg font-bold text-navy">Recent Sermons</h2></div>{loading ? <Card className="p-8 text-center text-sm text-slate-500">Loading recent sermons...</Card> : sermons.length === 0 ? <Card className="p-8 text-center text-sm text-slate-500">Recent video sermons will appear here after they are published in the Sermon Archive.</Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sermons.map((sermon) => <Card className="p-5" key={sermon.id}><PlayCircle className="h-8 w-8 text-churchblue" /><h3 className="mt-4 font-bold text-navy">{sermon.title}</h3><p className="mt-2 text-xs text-slate-400">{sermon.speaker} · {sermon.sermonDate}</p><a className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-churchblue hover:text-navy" href={sermon.mediaUrl} rel="noreferrer" target="_blank">Watch sermon <ExternalLink className="h-3.5 w-3.5" /></a></Card>)}</div>}</section>
    {showStreamForm && <StreamModal editing={Boolean(editingStream)} form={streamForm} saving={saving} onClose={() => { setShowStreamForm(false); setEditingStream(null); }} onForm={setStreamForm} onSubmit={saveStream} />}
    {showChannelForm && <ChannelModal form={channelForm} saving={saving} onClose={() => setShowChannelForm(false)} onForm={setChannelForm} onSubmit={saveChannel} />}
  </div>;
}

function StreamCard({ stream, canManage, onStatus, onDelete, onEdit }: { stream: Stream; canManage: boolean; onStatus: (stream: Stream, status: StreamStatus) => void; onDelete: (stream: Stream) => void; onEdit: (stream: Stream) => void }) {
  return <Card className="flex flex-col p-5"><div className="flex items-start justify-between gap-3"><RadioTower className="h-6 w-6 text-churchblue" /><div className="flex gap-2"><StatusBadge tone={stream.status === "live" ? "red" : stream.status === "completed" ? "green" : stream.status === "cancelled" ? "slate" : "gold"}>{pretty(stream.status)}</StatusBadge><StatusBadge tone="blue">{pretty(stream.source)}</StatusBadge></div></div><h3 className="mt-4 font-bold text-navy">{stream.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{stream.description || "Hamburg Ghana SDA Church online service."}</p><p className="mt-4 text-xs font-semibold text-slate-400">{formatDate(stream.startsAt)}</p><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><a className="inline-flex h-9 items-center gap-2 rounded-lg bg-churchblue px-3 text-sm font-semibold text-white hover:bg-navy" href={stream.watchUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /> Open</a>{canManage && <Button size="sm" variant="outline" onClick={() => onEdit(stream)}><Edit3 className="h-4 w-4" /> Edit</Button>}{canManage && stream.status !== "completed" && <Button size="sm" variant="outline" onClick={() => onStatus(stream, "completed")}><Square className="h-4 w-4" /> End</Button>}{canManage && <select aria-label={`Set status for ${stream.title}`} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600" value={stream.status} onChange={(event) => onStatus(stream, event.target.value as StreamStatus)}>{statuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select>}{canManage && <Button aria-label={`Delete ${stream.title}`} size="icon" variant="ghost" onClick={() => onDelete(stream)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}</div></Card>;
}

function StreamModal({ editing, form, saving, onClose, onForm, onSubmit }: { editing: boolean; form: StreamForm; saving: boolean; onClose: () => void; onForm: (form: StreamForm) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title={editing ? "Edit Livestream" : form.status === "live" ? "Create Livestream" : "Schedule Livestream"} saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Title<input className={fieldClass} required value={form.title} onChange={(event) => onForm({ ...form, title: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Stream source<select className={fieldClass} value={form.source} onChange={(event) => onForm({ ...form, source: event.target.value as StreamSource })}><option value="youtube">YouTube Live URL</option><option value="facebook">Facebook Live URL</option><option value="custom">Custom Embed URL</option></select></label><label className="text-sm font-semibold text-slate-700">Status<select className={fieldClass} value={form.status} onChange={(event) => onForm({ ...form, status: event.target.value as StreamStatus })}>{statuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">{form.source === "custom" ? "Custom Embed URL" : form.source === "facebook" ? "Facebook Live URL" : "YouTube Live URL"}<input className={fieldClass} required placeholder={form.source === "custom" ? "https://example.com/embed/live" : form.source === "facebook" ? "https://www.facebook.com/.../videos/..." : "https://www.youtube.com/watch?v=..."} type="url" value={form.url} onChange={(event) => onForm({ ...form, url: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Start time<input className={fieldClass} required type="datetime-local" value={form.startsAt} onChange={(event) => onForm({ ...form, startsAt: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">End time<input className={fieldClass} type="datetime-local" value={form.endsAt ?? ""} onChange={(event) => onForm({ ...form, endsAt: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className={textareaClass} value={form.description} onChange={(event) => onForm({ ...form, description: event.target.value })} /></label></div></Modal>;
}

function ChannelModal({ form, saving, onClose, onForm, onSubmit }: { form: Channel; saving: boolean; onClose: () => void; onForm: (form: Channel) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Configure Livestream Channel" saving={saving} onClose={onClose} onSubmit={onSubmit}><label className="text-sm font-semibold text-slate-700">Channel name<input className={fieldClass} required value={form.name} onChange={(event) => onForm({ ...form, name: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Main livestream channel URL<input className={fieldClass} placeholder="https://www.youtube.com/@your-channel" type="url" value={form.url} onChange={(event) => onForm({ ...form, url: event.target.value })} /></label></Modal>;
}

function Modal({ title, children, saving, onClose, onSubmit }: { title: string; children: React.ReactNode; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church livestream ministry</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="space-y-4 p-5">{children}</div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit"><RadioTower className="h-4 w-4" /> {saving ? "Saving..." : "Save"}</Button></div></form></div>;
}
