"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles, type AppRole } from "@/lib/auth";
import { churchLocation, fallbackChurchProfile, normalizeChurchProfile, type ChurchProfile } from "@/lib/church-profile";

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue disabled:bg-slate-50 disabled:text-slate-400";
const textareaClass = "mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-churchblue disabled:bg-slate-50 disabled:text-slate-400";

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
        if (result.error) setError(`${result.error.message}. Apply migration 202606120006_church_profile_settings.sql in Supabase.`);
        else setProfile(normalizeChurchProfile(result.data as Partial<ChurchProfile> | null));
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
        <Card className="p-5"><h2 className="font-bold text-navy">Notes</h2><textarea className={textareaClass} disabled={!canManage} value={profile.notes} onChange={(event) => update("notes", event.target.value)} /></Card>
        {canManage && <div className="flex justify-end"><Button disabled={saving} type="submit"><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Church Profile"}</Button></div>}
      </form>
    </div>
  );
}

function Input({ field, value, disabled, onChange }: { field: keyof ChurchProfile; value: string; disabled: boolean; onChange: (field: keyof ChurchProfile, value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{labelize(field)}<input className={fieldClass} disabled={disabled} value={value} onChange={(event) => onChange(field, event.target.value)} /></label>;
}
