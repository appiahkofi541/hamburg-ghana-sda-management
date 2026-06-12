"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { jsPDF as JsPDFDocument } from "jspdf";
import { Download, IdCard, KeyRound, Mail, MapPin, Pencil, Phone, Printer, QrCode, Save, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { MemberAvatar } from "@/components/member-avatar";
import { removeMemberPhoto, uploadMemberPhoto, validateMemberPhoto } from "@/lib/member-photos";
import { fallbackChurchProfile, loadPublicChurchProfile, type ChurchProfile } from "@/lib/church-profile";

type DepartmentMembership = {
  department_id?: string | null;
  departments?: { name?: string | null; is_active?: boolean | null } | { name?: string | null; is_active?: boolean | null }[] | null;
};

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
  department_members?: DepartmentMembership[] | null;
};

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not set";
}

function initialsFromText(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts : ["HG"]).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function imageFormat(dataUrl: string) {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

async function imageToDataUrl(url: string) {
  if (!url) return "";
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function memberLookupUrl(memberNumber: string) {
  const baseUrl = typeof window === "undefined" ? "https://hamburg-ghana-sda-management.vercel.app" : window.location.origin;
  return `${baseUrl}/members/lookup/${encodeURIComponent(memberNumber)}`;
}

function qrImageUrl(memberNumber: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(memberLookupUrl(memberNumber))}`;
}

function issueDate() {
  return new Date().toLocaleDateString("en-GB");
}

function expiryYear() {
  return String(new Date().getFullYear() + 2);
}

function departmentName(profile: MemberProfileRow) {
  const membership = profile.department_members?.[0];
  const department = Array.isArray(membership?.departments) ? membership.departments[0] : membership?.departments;
  return department?.name || "Not assigned";
}

async function drawSelfServiceCard(document: JsPDFDocument, profile: MemberProfileRow, church: ChurchProfile, x: number, y: number, width: number, height: number) {
  const [logoData, photoData, qrData] = await Promise.all([
    imageToDataUrl(church.logo_url),
    imageToDataUrl(profile.photo_thumbnail_url || profile.photo_url || ""),
    imageToDataUrl(qrImageUrl(profile.member_number, 220)),
  ]);
  const fullName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const cardRight = x + width;
  document.setFillColor(8, 41, 76);
  document.roundedRect(x, y, width, height, 4, 4, "F");
  document.setFillColor(255, 255, 255);
  document.roundedRect(x + 1.2, y + 1.2, width - 2.4, height - 2.4, 3.2, 3.2, "F");
  document.setFillColor(8, 41, 76);
  document.roundedRect(x + 1.2, y + 1.2, width - 2.4, 14, 3.2, 3.2, "F");
  document.setFillColor(240, 193, 90);
  document.rect(x + 1.2, y + 13, width - 2.4, 2.2, "F");
  if (logoData) document.addImage(logoData, imageFormat(logoData), x + 5, y + 3.8, 9, 9);
  else {
    document.setFillColor(255, 255, 255);
    document.circle(x + 9.5, y + 8.2, 4.4, "F");
    document.setTextColor(8, 41, 76);
    document.setFontSize(4.8);
    document.text(initialsFromText(church.short_name), x + 9.5, y + 9.7, { align: "center" });
  }
  document.setTextColor(255, 255, 255);
  document.setFontSize(7.2);
  document.text(church.church_name, x + 17, y + 7.5, { maxWidth: width - 44 });
  document.setFontSize(4.8);
  document.text("MEMBER ID CARD", x + 17, y + 12.2);
  document.setTextColor(240, 193, 90);
  document.setFontSize(5);
  document.text(profile.member_number, cardRight - 6, y + 9.4, { align: "right" });

  const photoX = x + 5;
  const photoY = y + 20;
  const photoSize = 22;
  document.setFillColor(226, 232, 240);
  document.roundedRect(photoX, photoY, photoSize, photoSize, 3, 3, "F");
  if (photoData) document.addImage(photoData, imageFormat(photoData), photoX, photoY, photoSize, photoSize);
  else {
    document.setTextColor(8, 41, 76);
    document.setFontSize(9);
    document.text(initialsFromText(fullName), photoX + photoSize / 2, photoY + 13, { align: "center" });
  }

  document.setTextColor(8, 41, 76);
  document.setFontSize(9.2);
  document.text(fullName, x + 31, y + 23, { maxWidth: 47 });
  document.setTextColor(37, 99, 235);
  document.setFontSize(6.5);
  document.text(profile.member_number, x + 31, y + 28);
  const details = [
    ["Department", departmentName(profile)],
    ["Status", titleCase(profile.status)],
    ["Phone", profile.phone || "-"],
    ["Email", profile.email || "-"],
  ];
  let detailY = y + 33;
  details.forEach(([label, value]) => {
    document.setTextColor(100, 116, 139);
    document.setFontSize(4.2);
    document.text(label.toUpperCase(), x + 31, detailY);
    document.setTextColor(8, 41, 76);
    document.setFontSize(5.2);
    document.text(String(value), x + 47, detailY, { maxWidth: 31 });
    detailY += 4.5;
  });
  if (qrData) document.addImage(qrData, imageFormat(qrData), cardRight - 27, y + 21, 20, 20);
  document.setTextColor(100, 116, 139);
  document.setFontSize(4);
  document.text("SCAN TO VERIFY", cardRight - 17, y + 44, { align: "center" });
  document.setDrawColor(226, 232, 240);
  document.line(x + 5, y + height - 8.4, cardRight - 5, y + height - 8.4);
  document.setFontSize(4.4);
  document.text(`Issued: ${issueDate()}`, x + 5, y + height - 4.7);
  document.text(`Expires: ${expiryYear()}`, x + 27, y + height - 4.7);
  document.text("If found, please return to Hamburg Ghana SDA Church", cardRight - 5, y + height - 4.7, { align: "right" });
}

export function MyProfile() {
  const [profile, setProfile] = useState<MemberProfileRow | null>();
  const [form, setForm] = useState<Partial<MemberProfileRow>>({});
  const [editing, setEditing] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [churchProfile, setChurchProfile] = useState<ChurchProfile>(fallbackChurchProfile);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data }, church] = await Promise.all([
        supabase.from("members").select("*, department_members(department_id, departments(name, is_active))").eq("profile_id", user.id).maybeSingle(),
        loadPublicChurchProfile(supabase),
      ]);
      setChurchProfile(church);
      setProfile(data);
      setForm(data ?? {});
    }
    load();
  }, []);

  const cardDepartment = useMemo(() => profile ? departmentName(profile) : "Not assigned", [profile]);
  const profileFullName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  async function downloadIdCardPdf() {
    if (!profile) return;
    const { jsPDF } = await import("jspdf");
    const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    await drawSelfServiceCard(document, profile, churchProfile, 15, 18, 86, 54);
    document.save(`${profile.member_number}-Member-ID-Card.pdf`);
  }

  function printIdCard() {
    if (!profile) return;
    const printWindow = window.open("", "_blank", "width=420,height=620");
    if (!printWindow) return;
    const logo = churchProfile.logo_url ? `<img class="logo" src="${escapeHtml(churchProfile.logo_url)}" alt="">` : `<div class="logo fallback">${escapeHtml(initialsFromText(churchProfile.short_name))}</div>`;
    const photoUrl = profile.photo_thumbnail_url || profile.photo_url || "";
    const photo = photoUrl ? `<img class="photo" src="${escapeHtml(photoUrl)}" alt="">` : `<div class="photo fallback">${escapeHtml(initialsFromText(profileFullName))}</div>`;
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(profile.member_number)} ID Card</title><style>@page{size:86mm 54mm;margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:white}.card{width:86mm;height:54mm;overflow:hidden;border-radius:4mm;border:1mm solid #08294c;background:white;color:#08294c;position:relative}.head{height:15mm;background:#08294c;color:white;display:grid;grid-template-columns:12mm 1fr auto;gap:3mm;align-items:center;padding:2.5mm 4mm;border-bottom:2mm solid #f0c15a}.logo{width:9mm;height:9mm;border-radius:2mm;background:white;object-fit:contain;padding:1mm}.logo.fallback{display:flex;align-items:center;justify-content:center;color:#08294c;font-weight:900;font-size:7px}.church{font-size:7.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;line-height:1.1}.kind{font-size:6px;color:#f0c15a;font-weight:800;margin-top:1mm}.number{font-size:7px;color:#f0c15a;font-weight:900}.body{display:grid;grid-template-columns:22mm 1fr 20mm;gap:3mm;padding:4mm}.photo{width:22mm;height:22mm;border-radius:3mm;background:#e2e8f0;object-fit:cover}.photo.fallback{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#08294c}.name{font-size:12px;font-weight:900;line-height:1.05;margin-bottom:1.5mm}.mid{font-size:7px;color:#2563eb;font-weight:900;margin-bottom:2mm}.label{font-size:4.8px;text-transform:uppercase;color:#64748b;font-weight:800}.value{font-size:6.3px;font-weight:800;margin:.3mm 0 1.2mm;line-height:1.05}.qr{width:18mm;height:18mm;border:0.4mm solid #e2e8f0;border-radius:2mm;padding:1mm}.scan{font-size:4.5px;color:#64748b;font-weight:800;text-align:center;margin-top:1mm}.foot{position:absolute;left:0;right:0;bottom:0;height:8mm;background:#f8fafc;padding:1.3mm 4mm;font-size:4.8px;color:#64748b}.return{margin-top:.5mm}@media print{.card{box-shadow:none}}</style></head><body><section class="card"><div class="head">${logo}<div><div class="church">${escapeHtml(churchProfile.church_name)}</div><div class="kind">Member ID Card</div></div><div class="number">${escapeHtml(profile.member_number)}</div></div><div class="body">${photo}<div><div class="name">${escapeHtml(profileFullName)}</div><div class="mid">${escapeHtml(profile.member_number)}</div><div class="label">Department</div><div class="value">${escapeHtml(cardDepartment)}</div><div class="label">Status</div><div class="value">${escapeHtml(titleCase(profile.status))}</div><div class="label">Phone</div><div class="value">${escapeHtml(profile.phone || "-")}</div><div class="label">Email</div><div class="value">${escapeHtml(profile.email || "-")}</div></div><div><img class="qr" src="${escapeHtml(qrImageUrl(profile.member_number, 220))}" alt="QR"><div class="scan">SCAN TO VERIFY</div></div></div><div class="foot"><span>Issued: ${escapeHtml(issueDate())}</span><span style="margin-left:8mm">Expires: ${escapeHtml(expiryYear())}</span><div class="return">If found, please return to Hamburg Ghana SDA Church</div></div></section><script>window.onload=()=>{window.print();}</script></body></html>`);
    printWindow.document.close();
  }

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
      setProfile((current) => current ? { ...current, ...data } : data);
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
      <Card className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-churchblue" />
              <h2 className="font-bold text-navy">My Membership Card</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">View, download, or print your Hamburg Ghana SDA Church member ID card.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowCard(true)}><IdCard className="h-4 w-4" /> View ID Card</Button>
            <Button variant="outline" onClick={() => void downloadIdCardPdf()}><Download className="h-4 w-4" /> Download PDF</Button>
            <Button variant="outline" onClick={printIdCard}><Printer className="h-4 w-4" /> Print ID Card</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <section className="aspect-[86/54] w-full max-w-[540px] overflow-hidden rounded-2xl border-[6px] border-navy-deep bg-white shadow-lg">
            <div className="grid h-[28%] grid-cols-[3rem_1fr_auto] items-center gap-3 border-b-4 border-gold bg-navy-deep px-4 text-white">
              {churchProfile.logo_url ? <object aria-label={`${churchProfile.church_name} logo`} className="h-10 w-10 rounded-md bg-white object-contain p-1" data={churchProfile.logo_url} type="image/png"><span className="flex h-full w-full items-center justify-center text-xs font-black text-navy">{initialsFromText(churchProfile.short_name)}</span></object> : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-xs font-black text-navy">{initialsFromText(churchProfile.short_name)}</div>}
              <div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-[0.16em] text-white">{churchProfile.church_name}</p><p className="mt-1 text-xs font-bold text-gold">Member ID Card</p></div>
              <p className="text-xs font-black text-gold">{profile.member_number}</p>
            </div>
            <div className="grid h-[72%] grid-cols-[5.25rem_1fr_5.5rem] gap-3 px-4 py-3">
              <MemberAvatar alt={profileFullName} className="h-20 w-20 rounded-lg" size="lg" src={profile.photo_thumbnail_url || profile.photo_url} />
              <div className="min-w-0">
                <h3 className="truncate text-xl font-black leading-tight text-navy">{profileFullName}</h3>
                <p className="mt-0.5 text-sm font-black text-churchblue">{profile.member_number}</p>
                <div className="mt-2 grid grid-cols-[4.5rem_1fr] gap-y-1 text-xs">
                  <span className="font-black uppercase text-slate-400">Department</span><span className="truncate font-bold text-navy">{cardDepartment}</span>
                  <span className="font-black uppercase text-slate-400">Status</span><span className="font-bold text-navy">{titleCase(profile.status)}</span>
                  <span className="font-black uppercase text-slate-400">Phone</span><span className="truncate font-bold text-navy">{profile.phone || "-"}</span>
                  <span className="font-black uppercase text-slate-400">Email</span><span className="truncate font-bold text-navy">{profile.email || "-"}</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-start">
                <object aria-label={`QR code for ${profile.member_number}`} className="h-[4.5rem] w-[4.5rem] rounded-lg border border-slate-100 p-1" data={qrImageUrl(profile.member_number)} type="image/png"><QrCode className="h-14 w-14 text-slate-300" /></object>
                <p className="mt-1 text-[9px] font-black uppercase text-slate-400">Scan to verify</p>
              </div>
              <div className="col-span-3 grid grid-cols-[auto_auto_1fr] gap-3 border-t border-slate-100 pt-1 text-[10px] font-bold text-slate-500">
                <span>Issued: {issueDate()}</span><span>Expires: {expiryYear()}</span><span className="truncate text-right">If found, please return to Hamburg Ghana SDA Church</span>
              </div>
            </div>
          </section>
          <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
            <object aria-label={`QR code for ${profile.member_number}`} className="h-28 w-28 rounded-lg border border-slate-200 bg-white p-2" data={qrImageUrl(profile.member_number, 180)} type="image/png"><QrCode className="h-20 w-20 text-slate-300" /></object>
            <p className="mt-3 text-xs font-semibold text-slate-500">QR verification opens:</p>
            <p className="mt-1 max-w-[15rem] break-all text-xs text-slate-400">{memberLookupUrl(profile.member_number)}</p>
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
      {showCard && <SelfServiceIdCardModal church={churchProfile} department={cardDepartment} member={profile} onClose={() => setShowCard(false)} onDownload={() => void downloadIdCardPdf()} onPrint={printIdCard} />}
    </div>
  );
}

function SelfServiceIdCardModal({ member, church, department, onClose, onDownload, onPrint }: { member: MemberProfileRow; church: ChurchProfile; department: string; onClose: () => void; onDownload: () => void; onPrint: () => void }) {
  const fullName = member.full_name || [member.first_name, member.last_name].filter(Boolean).join(" ");
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 print:hidden"><div><h2 className="font-bold text-navy">My Membership Card</h2><p className="mt-1 text-xs text-slate-400">{member.member_number}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close ID card" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="p-5"><section className="mx-auto aspect-[86/54] w-full max-w-[540px] overflow-hidden rounded-2xl border-[6px] border-navy-deep bg-white shadow-lg"><div className="grid h-[28%] grid-cols-[3rem_1fr_auto] items-center gap-3 border-b-4 border-gold bg-navy-deep px-4 text-white">{church.logo_url ? <object aria-label={`${church.church_name} logo`} className="h-10 w-10 rounded-md bg-white object-contain p-1" data={church.logo_url} type="image/png"><span className="flex h-full w-full items-center justify-center text-xs font-black text-navy">{initialsFromText(church.short_name)}</span></object> : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-xs font-black text-navy">{initialsFromText(church.short_name)}</div>}<div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-[0.16em] text-white">{church.church_name}</p><p className="mt-1 text-xs font-bold text-gold">Member ID Card</p></div><p className="text-xs font-black text-gold">{member.member_number}</p></div><div className="grid h-[72%] grid-cols-[5.25rem_1fr_5.5rem] gap-3 px-4 py-3"><MemberAvatar alt={fullName} className="h-20 w-20 rounded-lg" size="lg" src={member.photo_thumbnail_url || member.photo_url} /><div className="min-w-0"><h3 className="truncate text-xl font-black leading-tight text-navy">{fullName}</h3><p className="mt-0.5 text-sm font-black text-churchblue">{member.member_number}</p><div className="mt-2 grid grid-cols-[4.5rem_1fr] gap-y-1 text-xs"><span className="font-black uppercase text-slate-400">Department</span><span className="truncate font-bold text-navy">{department}</span><span className="font-black uppercase text-slate-400">Status</span><span className="font-bold text-navy">{titleCase(member.status)}</span><span className="font-black uppercase text-slate-400">Phone</span><span className="truncate font-bold text-navy">{member.phone || "-"}</span><span className="font-black uppercase text-slate-400">Email</span><span className="truncate font-bold text-navy">{member.email || "-"}</span></div></div><div className="flex flex-col items-center justify-start"><object aria-label={`QR code for ${member.member_number}`} className="h-[4.5rem] w-[4.5rem] rounded-lg border border-slate-100 p-1" data={qrImageUrl(member.member_number)} type="image/png"><QrCode className="h-14 w-14 text-slate-300" /></object><p className="mt-1 text-[9px] font-black uppercase text-slate-400">Scan to verify</p></div><div className="col-span-3 grid grid-cols-[auto_auto_1fr] gap-3 border-t border-slate-100 pt-1 text-[10px] font-bold text-slate-500"><span>Issued: {issueDate()}</span><span>Expires: {expiryYear()}</span><span className="truncate text-right">If found, please return to Hamburg Ghana SDA Church</span></div></div></section><p className="mx-auto mt-3 max-w-[540px] truncate text-center text-[10px] text-slate-400">{memberLookupUrl(member.member_number)}</p><div className="mt-5 flex flex-wrap justify-end gap-2 print:hidden"><Button variant="outline" onClick={onDownload}><Download className="h-4 w-4" /> Download PDF</Button><Button variant="outline" onClick={onPrint}><Printer className="h-4 w-4" /> Print ID Card</Button><Button onClick={onClose}>Done</Button></div></div></div></div>;
}
