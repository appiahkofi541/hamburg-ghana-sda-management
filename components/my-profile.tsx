"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, MapPin, Pencil, Phone, Save, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { MemberAvatar } from "@/components/member-avatar";
import { removeMemberPhoto, uploadMemberPhoto, validateMemberPhoto } from "@/lib/member-photos";

type MemberProfileRow = {
  member_number: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  email?: string | null;
  address_line?: string | null;
  baptism_status?: boolean | null;
  baptism_date?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  status?: string | null;
  id?: string;
  photo_url?: string | null;
  photo_thumbnail_url?: string | null;
};

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not set";
}

export function MyProfile() {
  const [profile, setProfile] = useState<MemberProfileRow | null>();
  const [form, setForm] = useState<Partial<MemberProfileRow>>({});
  const [editing, setEditing] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("members").select("*").eq("profile_id", user.id).maybeSingle();
      setProfile(data);
      setForm(data ?? {});
    }
    load();
  }, []);

  async function changePhoto(file: File | null) {
    if (!file || !profile?.id) return;
    const validationError = validateMemberPhoto(file);
    if (validationError) { setError(validationError); return; }
    const supabase = createClient();
    if (!supabase) return;
    setSavingPhoto(true);
    setError("");
    try {
      const uploaded = await uploadMemberPhoto(supabase, profile.id, file);
      setProfile((current) => current ? { ...current, photo_url: uploaded.photoUrl, photo_thumbnail_url: uploaded.thumbnailUrl } : current);
      setNotice("Profile photo updated.");
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Unable to upload profile photo.");
    }
    setSavingPhoto(false);
  }

  async function removePhoto() {
    if (!profile?.id || !window.confirm("Remove your profile photo?")) return;
    const supabase = createClient();
    if (!supabase) return;
    setSavingPhoto(true);
    setError("");
    try {
      await removeMemberPhoto(supabase, profile.id);
      setProfile((current) => current ? { ...current, photo_url: null, photo_thumbnail_url: null } : current);
      setNotice("Profile photo removed.");
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Unable to remove profile photo.");
    }
    setSavingPhoto(false);
  }

  function startEdit() {
    if (!profile) return;
    setForm(profile);
    setEditing(true);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.id) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError("");
    const payload = {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      full_name: `${form.first_name ?? ""} ${form.last_name ?? ""}`.trim() || profile.full_name,
      phone: form.phone || null,
      whatsapp_phone: form.whatsapp_phone || null,
      email: form.email || null,
      address_line: form.address_line || null,
      marital_status: form.marital_status || null,
      occupation: form.occupation || null,
    };
    const { data, error: saveError } = await supabase.from("members").update(payload).eq("id", profile.id).select("*").single();
    if (saveError) setError(saveError.message);
    else {
      setProfile(data);
      setForm(data);
      setEditing(false);
      setNotice("Profile updated successfully.");
    }
    setSaving(false);
  }

  if (profile === undefined) return <p className="p-8 text-center text-sm text-slate-500">Loading your profile...</p>;
  if (!profile) return <Card className="p-8 text-center"><p className="font-bold text-navy">No member profile is linked to this login yet.</p><p className="mt-2 text-sm text-slate-500">Please contact the church secretary to connect your account to your membership record.</p><Link href="/dashboard"><Button className="mt-4">Back to Dashboard</Button></Link></Card>;

  return (
    <div className="space-y-6">
      <PageHeading title="My Profile" description="Your Hamburg Ghana SDA Church membership record." />
      {notice && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <MemberAvatar alt={profile.full_name} size="lg" src={profile.photo_thumbnail_url || profile.photo_url} />
            <label className="block">
              <span className="sr-only">Change profile photo</span>
              <input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="block w-44 text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-churchblue" disabled={savingPhoto} type="file" onChange={(event) => changePhoto(event.target.files?.[0] ?? null)} />
              <span className="mt-1 block max-w-44 text-xs text-slate-400">JPG, PNG, or WEBP. Profile photo must be 4 MB or smaller. Large images are resized automatically.</span>
            </label>
            {(profile.photo_thumbnail_url || profile.photo_url) && <Button type="button" size="sm" variant="outline" disabled={savingPhoto} onClick={removePhoto}><Trash2 className="h-4 w-4" /> Remove Photo</Button>}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-navy">{profile.full_name}</h1><StatusBadge tone="green">{titleCase(profile.status)}</StatusBadge></div>
            <p className="mt-1 text-sm text-slate-500">{profile.member_number}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{profile.email || "No email"}</span>
              <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{profile.phone || "No phone"}</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{profile.address_line || "No address"}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={startEdit}><Pencil className="h-4 w-4" /> Edit Profile</Button>
              <Link href="/change-password"><Button variant="outline"><KeyRound className="h-4 w-4" /> Change Password</Button></Link>
            </div>
          </div>
        </div>
      </Card>
      {editing && <Card className="p-6">
        <form className="space-y-4" onSubmit={saveProfile}>
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-navy">Edit My Profile</h2><p className="mt-1 text-sm text-slate-500">Members can update their own contact and basic profile information.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Cancel edit" onClick={() => setEditing(false)}><X className="h-5 w-5" /></Button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["First Name", "first_name"],
              ["Last Name", "last_name"],
              ["Phone", "phone"],
              ["WhatsApp", "whatsapp_phone"],
              ["Email", "email"],
              ["Address", "address_line"],
              ["Marital Status", "marital_status"],
              ["Occupation", "occupation"],
            ].map(([label, key]) => <label className="text-sm font-semibold text-slate-700" key={key}>{label}<input className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-churchblue" value={String(form[key as keyof MemberProfileRow] ?? "")} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
          </div>
          <Button disabled={saving} type="submit"><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Profile"}</Button>
        </form>
      </Card>}
      <Card className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["First Name", profile.first_name || "Not set"],
          ["Last Name", profile.last_name || "Not set"],
          ["Gender", titleCase(profile.gender)],
          ["Date of Birth", profile.date_of_birth || "Not set"],
          ["WhatsApp", profile.whatsapp_phone || "Not set"],
          ["Baptism Status", profile.baptism_status ? "Baptized" : "Not baptized"],
          ["Baptism Date", profile.baptism_date || "Not set"],
          ["Marital Status", titleCase(profile.marital_status)],
          ["Occupation", profile.occupation || "Not set"],
        ].map(([label, value]) => <div key={label}><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-navy">{value}</p></div>)}
      </Card>
    </div>
  );
}
