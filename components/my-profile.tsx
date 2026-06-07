"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { MemberAvatar } from "@/components/member-avatar";
import { uploadMemberPhoto, validateMemberPhoto } from "@/lib/member-photos";

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
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("members").select("*").eq("profile_id", user.id).maybeSingle();
      setProfile(data);
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
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Unable to upload profile photo.");
    }
    setSavingPhoto(false);
  }

  if (profile === undefined) return <p className="p-8 text-center text-sm text-slate-500">Loading your profile...</p>;
  if (!profile) return <Card className="p-8 text-center"><p className="font-bold text-navy">No member profile is linked to this login yet.</p><p className="mt-2 text-sm text-slate-500">Please contact the church secretary to connect your account to your membership record.</p><Link href="/dashboard"><Button className="mt-4">Back to Dashboard</Button></Link></Card>;

  return (
    <div className="space-y-6">
      <PageHeading title="My Profile" description="Your Hamburg Ghana SDA Church membership record." />
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <MemberAvatar alt={profile.full_name} size="lg" src={profile.photo_thumbnail_url || profile.photo_url} />
            <label className="block">
              <span className="sr-only">Change profile photo</span>
              <input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="block w-44 text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-churchblue" disabled={savingPhoto} type="file" onChange={(event) => changePhoto(event.target.files?.[0] ?? null)} />
              <span className="mt-1 block max-w-44 text-xs text-slate-400">JPG, PNG, or WEBP. 4 MB max.</span>
            </label>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-navy">{profile.full_name}</h1><StatusBadge tone="green">{titleCase(profile.status)}</StatusBadge></div>
            <p className="mt-1 text-sm text-slate-500">{profile.member_number}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{profile.email || "No email"}</span>
              <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{profile.phone || "No phone"}</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{profile.address_line || "No address"}</span>
            </div>
          </div>
        </div>
      </Card>
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
