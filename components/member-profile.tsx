"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { MemberAvatar } from "@/components/member-avatar";
import { uploadMemberPhoto, validateMemberPhoto } from "@/lib/member-photos";

type MemberRow = Record<string, unknown> & {
  id?: string;
  profile_id?: string | null;
  photo_url?: string | null;
  photo_thumbnail_url?: string | null;
};

export function MemberProfile({ id }: { id: string }) {
  const [member, setMember] = useState<MemberRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManagePhoto, setCanManagePhoto] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (supabase) {
        const [{ data }, { data: { user } }] = await Promise.all([
          supabase.from("members").select("*, department_members(departments(name))").eq("id", id).maybeSingle(),
          supabase.auth.getUser(),
        ]);
        setMember(data);
        if (user && data) {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          setCanManagePhoto((roles ?? []).some(({ role }) => ["super_admin", "church_clerk", "secretary"].includes(role)) || data.profile_id === user.id);
        }
      } else {
        const stored = JSON.parse(window.localStorage.getItem("hamburg-ghana-sda-members") || "[]");
        setMember(stored.find((item: { id: string }) => item.id === id) ?? null);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function changePhoto(file: File | null) {
    if (!file || !member?.id) return;
    const validationError = validateMemberPhoto(file);
    if (validationError) { setError(validationError); return; }
    const supabase = createClient();
    if (!supabase) return;
    setSavingPhoto(true);
    setError("");
    try {
      const uploaded = await uploadMemberPhoto(supabase, member.id, file);
      setMember((current) => current ? { ...current, photo_url: uploaded.photoUrl, photo_thumbnail_url: uploaded.thumbnailUrl } : current);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Unable to upload profile photo.");
    }
    setSavingPhoto(false);
  }

  if (loading) return <p className="text-sm text-slate-500">Loading member profile...</p>;
  if (!member) return <Card className="p-8 text-center"><p className="font-bold text-navy">Member not found</p><Link href="/members"><Button className="mt-4">Back to Members</Button></Link></Card>;

  const firstName = String(member.firstName ?? member.first_name ?? "");
  const lastName = String(member.lastName ?? member.last_name ?? "");
  const fullName = `${firstName} ${lastName}`.trim() || String(member.full_name ?? "Member");
  const value = (camel: string, snake: string) => String(member[camel] ?? member[snake] ?? "Not set");
  const department = String(member.department ?? (member.department_members as { departments?: { name?: string } }[] | undefined)?.[0]?.departments?.name ?? "Not set");
  const photo = String(member.photo_thumbnail_url || member.photo_url || "");

  return <div className="space-y-6"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-churchblue" href="/members"><ArrowLeft className="h-4 w-4" /> Back to Members</Link>{error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<Card className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="space-y-3"><MemberAvatar alt={fullName} size="lg" src={photo} />{canManagePhoto && <label className="block"><span className="sr-only">Change profile photo</span><input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="block w-44 text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-churchblue" disabled={savingPhoto} type="file" onChange={(event) => changePhoto(event.target.files?.[0] ?? null)} /><span className="mt-1 block max-w-44 text-xs text-slate-400">JPG, PNG, or WEBP. 4 MB max.</span></label>}</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-navy">{fullName}</h1><StatusBadge>{value("membershipStatus", "status")}</StatusBadge></div><p className="mt-1 text-sm text-slate-500">{value("memberId", "member_number")}</p><div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500"><span className="flex items-center gap-1"><Mail className="h-4 w-4" />{value("email", "email")}</span><span className="flex items-center gap-1"><Phone className="h-4 w-4" />{value("phone", "phone")}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{value("address", "address_line")}</span></div></div></div></Card><Card className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">{[["Gender", value("gender", "gender")], ["Date of Birth", value("dateOfBirth", "date_of_birth")], ["Marital Status", value("maritalStatus", "marital_status")], ["Occupation", value("occupation", "occupation")], ["Department", department], ["Baptism Status", (member.baptismStatus ?? member.baptism_status) ? "Baptized" : "Not baptized"], ["Baptism Date", value("baptismDate", "baptism_date")]].map(([label, field]) => <div key={label}><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-navy">{field}</p></div>)}</Card></div>;
}
