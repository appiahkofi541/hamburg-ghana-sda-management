"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive, BookOpen, Download, ExternalLink, FileAudio, FileText, Library,
  Plus, Search, Trash2, Upload, Video, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type MediaType = "video" | "audio" | "pdf" | "sabbath_school_lesson";
type SermonStatus = "draft" | "published" | "archived";
type Category = { id: string; name: string };
type Sermon = {
  id: string;
  title: string;
  description: string;
  speaker: string;
  sermonDate: string;
  mediaType: MediaType;
  categoryId: string;
  categoryName: string;
  mediaUrl: string;
  storagePath: string | null;
  durationMinutes: number | null;
  status: SermonStatus;
};

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const mediaMeta: Record<MediaType, { label: string; icon: LucideIcon; tone: string }> = {
  video: { label: "Video Sermon", icon: Video, tone: "bg-blue-50 text-churchblue" },
  audio: { label: "Audio Sermon", icon: FileAudio, tone: "bg-emerald-50 text-emerald-700" },
  pdf: { label: "PDF Sermon", icon: FileText, tone: "bg-rose-50 text-rose-700" },
  sabbath_school_lesson: { label: "Sabbath School Lesson", icon: BookOpen, tone: "bg-amber-50 text-amber-700" },
};
const statuses: SermonStatus[] = ["published", "draft", "archived"];
const emptyForm = {
  title: "", speaker: "", sermonDate: new Date().toISOString().slice(0, 10),
  mediaType: "video" as MediaType, categoryId: "", description: "",
  mediaUrl: "", durationMinutes: "", status: "published" as SermonStatus,
};

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function SermonArchive() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState<MediaType | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadArchive() {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Add the public project URL and anonymous key to use the sermon archive.");
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setCanManage((roleRows ?? []).some(({ role }) => ["admin", "pastor", "secretary"].includes(role)));
    }
    const [{ data: categoryRows, error: categoryError }, { data: sermonRows, error: sermonError }] = await Promise.all([
      supabase.from("sermon_categories").select("id, name").order("name"),
      supabase.from("sermons").select("*, sermon_categories(name)").order("sermon_date", { ascending: false }),
    ]);
    if (categoryError || sermonError) {
      setError(categoryError?.message ?? sermonError?.message ?? "Unable to load the sermon archive.");
    } else {
      setCategories(categoryRows ?? []);
      setSermons((sermonRows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? "",
        speaker: row.speaker ?? "",
        sermonDate: row.sermon_date,
        mediaType: row.media_type,
        categoryId: row.category_id ?? "",
        categoryName: row.sermon_categories?.name ?? "Uncategorized",
        mediaUrl: row.media_url,
        storagePath: row.storage_path,
        durationMinutes: row.duration_minutes,
        status: row.status,
      })));
    }
    setLoading(false);
  }

  useEffect(() => { loadArchive(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sermons.filter((sermon) =>
      (categoryFilter === "all" || sermon.categoryId === categoryFilter)
      && (mediaFilter === "all" || sermon.mediaType === mediaFilter)
      && (!normalized || `${sermon.title} ${sermon.speaker} ${sermon.description} ${sermon.categoryName}`.toLowerCase().includes(normalized)),
    );
  }, [categoryFilter, mediaFilter, query, sermons]);

  async function submitSermon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(form.title, "Title") || required(form.sermonDate, "Sermon date")
      || (!file ? required(form.mediaUrl, "Media URL or file") : null);
    if (validationError) { setError(validationError); return; }
    if (form.mediaUrl) {
      try { new URL(form.mediaUrl); } catch { setError("Media URL must be a complete web address."); return; }
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setError("");
    let mediaUrl = form.mediaUrl;
    let storagePath: string | null = null;
    if (file) {
      storagePath = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("sermon-media").upload(storagePath, file);
      if (uploadError) { setError(uploadError.message); setSaving(false); return; }
      mediaUrl = supabase.storage.from("sermon-media").getPublicUrl(storagePath).data.publicUrl;
    }
    const { error: insertError } = await supabase.from("sermons").insert({
      title: form.title,
      speaker: form.speaker || null,
      sermon_date: form.sermonDate,
      media_type: form.mediaType,
      category_id: form.categoryId || null,
      description: form.description || null,
      media_url: mediaUrl,
      storage_path: storagePath,
      duration_minutes: form.durationMinutes ? Number(form.durationMinutes) : null,
      status: form.status,
    });
    if (insertError) {
      if (storagePath) await supabase.storage.from("sermon-media").remove([storagePath]);
      setError(insertError.message); setSaving(false); return;
    }
    setNotice("Sermon resource added to the archive.");
    setForm(emptyForm); setFile(null); setShowForm(false); setSaving(false);
    await loadArchive();
  }

  async function updateStatus(sermon: Sermon, status: SermonStatus) {
    const supabase = createClient();
    if (!supabase) return;
    const { error: updateError } = await supabase.from("sermons").update({ status }).eq("id", sermon.id);
    if (updateError) { setError(updateError.message); return; }
    setSermons((current) => current.map((item) => item.id === sermon.id ? { ...item, status } : item));
    setNotice(`Sermon marked ${status}.`);
  }

  async function deleteSermon(sermon: Sermon) {
    if (!window.confirm(`Delete "${sermon.title}" from the archive?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("sermons").delete().eq("id", sermon.id);
    if (deleteError) { setError(deleteError.message); return; }
    if (sermon.storagePath) await supabase.storage.from("sermon-media").remove([sermon.storagePath]);
    setSermons((current) => current.filter(({ id }) => id !== sermon.id));
    setNotice("Sermon resource deleted.");
  }

  async function downloadSermon(sermon: Sermon) {
    if (!sermon.storagePath) return;
    const supabase = createClient();
    if (!supabase) return;
    setDownloadingId(sermon.id); setError("");
    const { data, error: downloadError } = await supabase.storage.from("sermon-media").download(sermon.storagePath);
    if (downloadError) setError(downloadError.message);
    else {
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = sermon.storagePath.replace(/^[0-9a-f-]{36}-/i, "");
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Resource download started.");
    }
    setDownloadingId("");
  }

  return <div className="space-y-6">
    <PageHeading title="Sermon Archive" description="Explore sermons, audio messages, PDF resources, and Sabbath School lessons from Hamburg Ghana SDA Church." />
    {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
    {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(mediaMeta).map(([type, { label, icon: Icon, tone }]) => <Card className="flex items-center gap-4 p-5" key={type}><div className={`rounded-lg p-3 ${tone}`}><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{sermons.filter(({ mediaType, status }) => mediaType === type && status === "published").length}</p></div></Card>)}
    </section>
    <Card className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
      <div><h2 className="font-bold text-navy">Church Media Library</h2><p className="mt-1 text-sm text-slate-500">Search resources by title, speaker, description, category, or format.</p></div>
      {canManage && <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Resource</Button>}
    </Card>
    <Card>
      <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[minmax(0,1fr)_12rem_14rem]">
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search sermon archive..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select className={fieldClass.replace("mt-1.5 ", "")} aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select className={fieldClass.replace("mt-1.5 ", "")} aria-label="Filter by media type" value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as typeof mediaFilter)}><option value="all">All formats</option>{Object.entries(mediaMeta).map(([value, { label }]) => <option value={value} key={value}>{label}</option>)}</select>
      </div>
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading sermon archive...</p> : filtered.length === 0 ? <div className="p-12 text-center"><Library className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-500">No sermon resources match your filters.</p></div> : <div className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">{filtered.map((sermon) => <SermonCard sermon={sermon} canManage={canManage} downloading={downloadingId === sermon.id} key={sermon.id} onDelete={deleteSermon} onDownload={downloadSermon} onStatus={updateStatus} />)}</div>}
    </Card>
    {showForm && <SermonModal categories={categories} file={file} form={form} saving={saving} onClose={() => setShowForm(false)} onFile={setFile} onForm={setForm} onSubmit={submitSermon} />}
  </div>;
}

function SermonCard({ sermon, canManage, downloading, onDelete, onDownload, onStatus }: { sermon: Sermon; canManage: boolean; downloading: boolean; onDelete: (sermon: Sermon) => void; onDownload: (sermon: Sermon) => void; onStatus: (sermon: Sermon, status: SermonStatus) => void }) {
  const { icon: Icon, label, tone } = mediaMeta[sermon.mediaType];
  return <article className="flex flex-col rounded-xl border border-slate-100 p-5">
    <div className="flex items-start justify-between gap-3"><div className={`rounded-lg p-3 ${tone}`}><Icon className="h-5 w-5" /></div><StatusBadge tone={sermon.status === "published" ? "green" : sermon.status === "draft" ? "gold" : "slate"}>{pretty(sermon.status)}</StatusBadge></div>
    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-churchblue">{label}</p><h3 className="mt-1 font-bold text-navy">{sermon.title}</h3>
    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-500">{sermon.description || "A ministry resource from Hamburg Ghana SDA Church."}</p>
    <div className="mt-4 space-y-1 text-xs text-slate-400"><p>{sermon.categoryName}</p><p>{sermon.speaker || "Hamburg Ghana SDA Church"} · {sermon.sermonDate}{sermon.durationMinutes ? ` · ${sermon.durationMinutes} min` : ""}</p></div>
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
      <a className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-churchblue px-3 text-sm font-semibold text-white transition-colors hover:bg-navy" href={sermon.mediaUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /> Open Resource</a>
      {sermon.storagePath && <Button disabled={downloading} size="sm" variant="outline" onClick={() => onDownload(sermon)}><Download className="h-4 w-4" /> {downloading ? "Downloading..." : "Download"}</Button>}
      {canManage && <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600" aria-label={`Set status for ${sermon.title}`} value={sermon.status} onChange={(event) => onStatus(sermon, event.target.value as SermonStatus)}>{statuses.map((status) => <option value={status} key={status}>{pretty(status)}</option>)}</select>}
      {canManage && <Button aria-label={`Delete ${sermon.title}`} size="icon" variant="ghost" onClick={() => onDelete(sermon)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}
    </div>
  </article>;
}

function SermonModal({ categories, file, form, saving, onClose, onFile, onForm, onSubmit }: { categories: Category[]; file: File | null; form: typeof emptyForm; saving: boolean; onClose: () => void; onFile: (file: File | null) => void; onForm: (form: typeof emptyForm) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">Add Sermon Resource</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church media library</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 md:grid-cols-2">
    <label className="text-sm font-semibold text-slate-700 md:col-span-2">Title<input className={fieldClass} required value={form.title} onChange={(event) => onForm({ ...form, title: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700">Speaker<input className={fieldClass} value={form.speaker} onChange={(event) => onForm({ ...form, speaker: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700">Date<input className={fieldClass} required type="date" value={form.sermonDate} onChange={(event) => onForm({ ...form, sermonDate: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700">Format<select className={fieldClass} value={form.mediaType} onChange={(event) => onForm({ ...form, mediaType: event.target.value as MediaType })}>{Object.entries(mediaMeta).map(([value, { label }]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">Category<select className={fieldClass} value={form.categoryId} onChange={(event) => onForm({ ...form, categoryId: event.target.value })}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">Duration (minutes)<input className={fieldClass} min="0" type="number" value={form.durationMinutes} onChange={(event) => onForm({ ...form, durationMinutes: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700">Status<select className={fieldClass} value={form.status} onChange={(event) => onForm({ ...form, status: event.target.value as SermonStatus })}>{statuses.map((status) => <option value={status} key={status}>{pretty(status)}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700 md:col-span-2">Description<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.description} onChange={(event) => onForm({ ...form, description: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700 md:col-span-2">External media URL<input className={fieldClass} placeholder="https://www.youtube.com/watch?v=..." type="url" value={form.mediaUrl} onChange={(event) => onForm({ ...form, mediaUrl: event.target.value })} /><span className="mt-1 block text-xs font-normal text-slate-400">Use a YouTube or external link, or upload a file below.</span></label>
    <label className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 md:col-span-2"><span className="flex items-center gap-2"><Upload className="h-4 w-4 text-churchblue" /> Upload audio, PDF, lesson, or video file</span><input className="mt-3 block w-full text-xs text-slate-500" type="file" accept="audio/*,video/*,.pdf" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />{file && <span className="mt-2 block text-xs font-normal text-slate-500">{file.name}</span>}</label>
  </div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit"><Archive className="h-4 w-4" /> {saving ? "Saving..." : "Add Resource"}</Button></div></form></div>;
}
