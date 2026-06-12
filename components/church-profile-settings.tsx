"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Download, FileSpreadsheet, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles, type AppRole } from "@/lib/auth";
import { churchLocation, fallbackChurchProfile, normalizeChurchElder, normalizeChurchProfile, type ChurchElder, type ChurchProfile } from "@/lib/church-profile";

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue disabled:bg-slate-50 disabled:text-slate-400";
const textareaClass = "mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-churchblue disabled:bg-slate-50 disabled:text-slate-400";
const emptyElder: ChurchElder = { id: "", elder_name: "", elder_phone: "", elder_email: "", sort_order: 0, is_active: true };

const groups: { title: string; fields: (keyof ChurchProfile)[] }[] = [
  { title: "Church Identity", fields: ["church_name", "short_name", "logo_url", "website", "default_currency", "default_language"] },
  { title: "Address & Contact", fields: ["address", "city", "country", "postal_code", "phone", "email"] },
  { title: "Leadership", fields: ["pastor_name", "pastor_phone", "pastor_email", "secretary_name", "secretary_phone", "secretary_email", "treasurer_name", "treasurer_phone", "treasurer_email"] },
  { title: "Worship Times", fields: ["sabbath_service_time", "prayer_meeting_time"] },
  { title: "Social Media", fields: ["social_facebook", "social_youtube", "social_instagram", "social_tiktok"] },
  { title: "Bank Details", fields: ["bank_name", "iban", "account_name"] },
];

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ChurchProfileSettings() {
  const [profile, setProfile] = useState<ChurchProfile>(fallbackChurchProfile);
  const [elders, setElders] = useState<ChurchElder[]>([]);
  const [elderForm, setElderForm] = useState<ChurchElder>(emptyElder);
  const [showElderForm, setShowElderForm] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const canManage = roles.includes("super_admin");
  const publicSummary = useMemo(() => [
    ["Church", profile.church_name],
    ["Address", churchLocation(profile) || "-"],
    ["Phone", profile.phone || "-"],
    ["Email", profile.email || "-"],
    ["Sabbath Service", profile.sabbath_service_time || "-"],
    ["Prayer Meeting", profile.prayer_meeting_time || "-"],
  ], [profile]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const normalized = normalizeRoles((roleRows ?? []).map(({ role }) => role));
        setRoles(normalized);
        const canViewFull = normalized.some((role) => ["super_admin", "pastor", "secretary", "treasurer"].includes(role));
        const result = canViewFull
          ? await supabase.from("church_settings").select("*").eq("id", true).maybeSingle()
          : await supabase.rpc("get_public_church_profile");
        const { data: elderRows, error: elderError } = await supabase.from("church_elders").select("*").eq("is_active", true).order("sort_order").order("elder_name");
        if (result.error) setError(`${result.error.message}. Apply migration 202606120006_church_profile_settings.sql in Supabase.`);
        else if (elderError) setError(`${elderError.message}. Apply migration 202606120007_church_elders_management.sql in Supabase.`);
        else setProfile(normalizeChurchProfile(result.data as Partial<ChurchProfile> | null));
        setElders((elderRows ?? []).map(normalizeChurchElder));
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) { setError("Only Super Admin/Admin can edit church profile settings."); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    if (supabase) {
      const { error: saveError } = await supabase.from("church_settings").upsert({ id: true, ...profile });
      if (saveError) { setError(saveError.message); setSaving(false); return; }
    }
    setNotice("Church profile saved.");
    setSaving(false);
  }

  function update(field: keyof ChurchProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function openElderForm(elder?: ChurchElder) {
    setElderForm(elder ?? { ...emptyElder, sort_order: elders.length + 1 });
    setShowElderForm(true);
  }

  async function saveElder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) { setError("Only Super Admin/Admin can manage elders."); return; }
    if (!elderForm.elder_name.trim()) { setError("Elder name is required."); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    if (supabase) {
      const payload = {
        elder_name: elderForm.elder_name.trim(),
        elder_phone: elderForm.elder_phone.trim() || null,
        elder_email: elderForm.elder_email.trim() || null,
        sort_order: elderForm.sort_order,
        is_active: true,
      };
      const request = elderForm.id ? supabase.from("church_elders").update(payload).eq("id", elderForm.id) : supabase.from("church_elders").insert(payload);
      const { error: saveError } = await request;
      if (saveError) { setError(saveError.message); setSaving(false); return; }
      const { data } = await supabase.from("church_elders").select("*").eq("is_active", true).order("sort_order").order("elder_name");
      setElders((data ?? []).map(normalizeChurchElder));
    }
    setNotice(elderForm.id ? "Elder updated." : "Elder added.");
    setShowElderForm(false);
    setSaving(false);
  }

  async function removeElder(elder: ChurchElder) {
    if (!canManage) return;
    if (!window.confirm(`Remove ${elder.elder_name}?`)) return;
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { error: deleteError } = await supabase.from("church_elders").update({ is_active: false }).eq("id", elder.id);
      if (deleteError) { setError(deleteError.message); setSaving(false); return; }
    }
    setElders((current) => current.filter((item) => item.id !== elder.id));
    setNotice("Elder removed.");
    setSaving(false);
  }

  function leadershipRows() {
    return [
      ["Pastor", profile.pastor_name, profile.pastor_phone, profile.pastor_email],
      ["Secretary", profile.secretary_name, profile.secretary_phone, profile.secretary_email],
      ["Treasurer", profile.treasurer_name, profile.treasurer_phone, profile.treasurer_email],
      ...elders.map((elder) => ["Elder", elder.elder_name, elder.elder_phone, elder.elder_email]),
    ].filter((row) => row.slice(1).some(Boolean));
  }

  function exportExcel() {
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const rows = [
      [profile.church_name],
      [churchLocation(profile)],
      ["Role", "Name", "Phone", "Email"],
      ...leadershipRows(),
    ];
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Church Profile"><Table>${rows.map(row).join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profile.short_name.replaceAll(" ", "-")}-Church-Profile.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF();
    document.setFontSize(16);
    document.text(`${profile.church_name} - Church Profile`, 14, 16);
    document.setFontSize(10);
    document.text(churchLocation(profile) || profile.country, 14, 23);
    autoTableModule.default(document, {
      startY: 32,
      head: [["Role", "Name", "Phone", "Email"]],
      body: leadershipRows(),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save(`${profile.short_name.replaceAll(" ", "-")}-Church-Profile.pdf`);
  }

  async function uploadLogo(file: File | null) {
    if (!file || !canManage) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    const path = `church-logo/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "-").toLowerCase()}`;
    const { error: uploadError } = await supabase.storage.from("church-assets").upload(path, file, { upsert: true });
    if (uploadError) {
      setError(`${uploadError.message}. If storage is not configured, paste a logo URL instead.`);
      setSaving(false);
      return;
    }
    const { data } = supabase.storage.from("church-assets").getPublicUrl(path);
    update("logo_url", data.publicUrl);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <PageHeading title="Church Profile" description="Manage official church identity, contact details, leadership contacts, service times, social links, and finance settings." />
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
          <Building2 className="h-4 w-4 text-churchblue" /> {loading ? "Loading..." : canManage ? "Editable" : "Read-only"}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> Export PDF</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
        </div>
      </div>
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

      <Card className="p-5">
        <div className="grid gap-5 lg:grid-cols-[12rem_1fr]">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
            {profile.logo_url ? <object aria-label={`${profile.church_name} logo`} className="h-full w-full object-contain" data={profile.logo_url} type="image/png"><Building2 className="h-10 w-10 text-slate-300" /></object> : <Building2 className="h-10 w-10 text-slate-300" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy">{profile.church_name}</h2>
            <p className="mt-1 text-sm text-slate-500">{churchLocation(profile) || "No address recorded."}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {publicSummary.slice(2).map(([label, value]) => <div key={label}><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-navy">{value}</p></div>)}
            </div>
            {canManage && <label className="mt-4 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Upload className="h-4 w-4" /> Upload Logo<input accept="image/*" className="hidden" type="file" onChange={(event) => void uploadLogo(event.target.files?.[0] ?? null)} /></label>}
          </div>
        </div>
      </Card>

      <form className="space-y-5" onSubmit={save}>
        {groups.map((group) => <Card className="p-5" key={group.title}><h2 className="font-bold text-navy">{group.title}</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{group.fields.map((field) => <Input disabled={!canManage} field={field} key={field} value={profile[field]} onChange={update} />)}</div></Card>)}
        <Card className="p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-navy">Elders</h2>
              <p className="mt-1 text-xs text-slate-400">Leadership contacts for pastoral care and church follow-up.</p>
            </div>
            {canManage && <Button type="button" onClick={() => openElderForm()}><Plus className="h-4 w-4" /> Add Elder</Button>}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {elders.map((elder) => <article className="rounded-lg border border-slate-100 p-4" key={elder.id || elder.elder_name}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-navy">{elder.elder_name}</p>
                  <p className="mt-1 text-xs text-slate-500">{elder.elder_phone || "No phone recorded"}</p>
                  <p className="mt-1 text-xs text-slate-500">{elder.elder_email || "No email recorded"}</p>
                </div>
                {canManage && <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" aria-label={`Edit ${elder.elder_name}`} onClick={() => openElderForm(elder)}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${elder.elder_name}`} onClick={() => void removeElder(elder)}><Trash2 className="h-4 w-4 text-rose-600" /></Button></div>}
              </div>
            </article>)}
            {elders.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-3">No elders recorded yet.</p>}
          </div>
        </Card>
        <Card className="p-5"><h2 className="font-bold text-navy">Notes</h2><textarea className={textareaClass} disabled={!canManage} value={profile.notes} onChange={(event) => update("notes", event.target.value)} /></Card>
        {canManage && <div className="flex justify-end"><Button disabled={saving} type="submit"><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Church Profile"}</Button></div>}
      </form>
      {showElderForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="w-full max-w-2xl rounded-xl bg-white shadow-2xl" onSubmit={saveElder}><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">{elderForm.id ? "Edit Elder" : "Add Elder"}</h2><p className="mt-1 text-xs text-slate-400">Church Profile leadership contact</p></div><Button type="button" size="icon" variant="ghost" aria-label="Close elder form" onClick={() => setShowElderForm(false)}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Elder Name<input className={fieldClass} required value={elderForm.elder_name} onChange={(event) => setElderForm({ ...elderForm, elder_name: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Elder Phone<input className={fieldClass} value={elderForm.elder_phone} onChange={(event) => setElderForm({ ...elderForm, elder_phone: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Elder Email<input className={fieldClass} type="email" value={elderForm.elder_email} onChange={(event) => setElderForm({ ...elderForm, elder_email: event.target.value })} /></label></div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={() => setShowElderForm(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Elder"}</Button></div></form></div>}
    </div>
  );
}

function Input({ field, value, disabled, onChange }: { field: keyof ChurchProfile; value: string; disabled: boolean; onChange: (field: keyof ChurchProfile, value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{labelize(field)}<input className={fieldClass} disabled={disabled} value={value} onChange={(event) => onChange(field, event.target.value)} /></label>;
}
