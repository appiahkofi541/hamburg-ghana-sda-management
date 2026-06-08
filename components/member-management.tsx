"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download, Eye, FileSpreadsheet, Pencil, Plus, Search, Trash2, UserRoundCheck,
  UserRoundPlus, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { required, validEmail } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { useT } from "@/components/language-provider";
import { MemberAvatar } from "@/components/member-avatar";
import { uploadMemberPhoto, validateMemberPhoto } from "@/lib/member-photos";

type MemberStatus = "Active" | "Inactive" | "Transferred" | "Deceased";
type MemberRecord = {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  baptismDate: string;
  baptismStatus: boolean;
  maritalStatus: string;
  occupation: string;
  departmentId: string;
  department: string;
  membershipStatus: MemberStatus;
  photoUrl: string;
  photoThumbnailUrl: string;
};

const emptyMember: MemberRecord = {
  id: "",
  memberId: "",
  firstName: "",
  lastName: "",
  gender: "",
  dateOfBirth: "",
  phone: "",
  whatsappPhone: "",
  email: "",
  address: "",
  baptismDate: "", baptismStatus: false,
  maritalStatus: "",
  occupation: "",
  departmentId: "",
  department: "",
  membershipStatus: "Active",
  photoUrl: "",
  photoThumbnailUrl: "",
};

const seedMembers: MemberRecord[] = [
  { id: "1", memberId: "HG-001", firstName: "Kwame", lastName: "Mensah", gender: "Male", dateOfBirth: "1982-04-16", phone: "+49 176 482 0193", whatsappPhone: "491764820193", email: "kwame.mensah@email.com", address: "Hamburg, Germany", baptismDate: "2001-08-11", baptismStatus: true, maritalStatus: "Married", occupation: "Engineer", departmentId: "", department: "", membershipStatus: "Active", photoUrl: "", photoThumbnailUrl: "" },
  { id: "2", memberId: "HG-002", firstName: "Akosua", lastName: "Boateng", gender: "Female", dateOfBirth: "1990-09-03", phone: "+49 157 594 2281", whatsappPhone: "491575942281", email: "akosua.boateng@email.com", address: "Hamburg, Germany", baptismDate: "2007-05-19", baptismStatus: true, maritalStatus: "Single", occupation: "Teacher", departmentId: "", department: "", membershipStatus: "Active", photoUrl: "", photoThumbnailUrl: "" },
  { id: "3", memberId: "HG-003", firstName: "Samuel", lastName: "Asare", gender: "Male", dateOfBirth: "1988-12-21", phone: "+49 176 319 8724", whatsappPhone: "491763198724", email: "samuel.asare@email.com", address: "Hamburg, Germany", baptismDate: "2005-07-09", baptismStatus: true, maritalStatus: "Married", occupation: "Accountant", departmentId: "", department: "", membershipStatus: "Active", photoUrl: "", photoThumbnailUrl: "" },
  { id: "4", memberId: "HG-004", firstName: "Esi", lastName: "Owusu", gender: "Female", dateOfBirth: "1985-06-12", phone: "+49 152 737 4309", whatsappPhone: "491527374309", email: "esi.owusu@email.com", address: "Hamburg, Germany", baptismDate: "2002-03-23", baptismStatus: true, maritalStatus: "Married", occupation: "Nurse", departmentId: "", department: "", membershipStatus: "Active", photoUrl: "", photoThumbnailUrl: "" },
  { id: "5", memberId: "HG-005", firstName: "Daniel", lastName: "Ofori", gender: "Male", dateOfBirth: "1998-02-09", phone: "+49 176 967 5110", whatsappPhone: "491769675110", email: "daniel.ofori@email.com", address: "Hamburg, Germany", baptismDate: "2016-10-15", baptismStatus: true, maritalStatus: "Single", occupation: "Designer", departmentId: "", department: "", membershipStatus: "Active", photoUrl: "", photoThumbnailUrl: "" },
];

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";
const storageKey = "hamburg-ghana-sda-members";
type DepartmentOption = { id: string; name: string; isActive: boolean };

function memberPayload(member: MemberRecord) {
  return {
    member_number: member.memberId,
    first_name: member.firstName,
    last_name: member.lastName,
    full_name: `${member.firstName} ${member.lastName}`.trim(),
    gender: member.gender.toLowerCase().replaceAll(" ", "_") || null,
    date_of_birth: member.dateOfBirth || null,
    phone: member.phone || null,
    whatsapp_phone: member.whatsappPhone || null,
    email: member.email || null,
    address_line: member.address || null,
    baptism_date: member.baptismDate || null,
    baptism_status: member.baptismStatus,
    marital_status: member.maritalStatus.toLowerCase().replaceAll(" ", "_") || null,
    occupation: member.occupation || null,
    status: member.membershipStatus.toLowerCase(),
  };
}

function titleCase(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

export function MemberManagement() {
  const t = useT();
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [form, setForm] = useState<MemberRecord>(emptyMember);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "All Statuses">("All Statuses");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  useEffect(() => {
    async function loadMembers() {
      const supabase = createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          setCanManage((roleRows ?? []).some(({ role }) => ["super_admin", "pastor", "elder", "church_clerk", "secretary"].includes(role)));
        }
        const [{ data, error: loadError }, { data: departmentRows }] = await Promise.all([
          supabase.from("members").select("*, department_members(department_id, departments(name, is_active))").order("last_name"),
          supabase.from("departments").select("id, name, is_active").order("name"),
        ]);
        setDepartments((departmentRows ?? []).map((department) => ({ id: department.id, name: department.name, isActive: department.is_active })));
        if (loadError) {
          setError(`Unable to load members: ${loadError.message}`);
          setLoading(false);
          return;
        }
        if (data) {
          setRecords(data.map((row) => ({
            id: row.id,
            memberId: row.member_number,
            firstName: row.first_name,
            lastName: row.last_name,
            gender: titleCase(row.gender),
            dateOfBirth: row.date_of_birth ?? "",
            phone: row.phone ?? "",
            whatsappPhone: row.whatsapp_phone ?? "",
            email: row.email ?? "",
            address: row.address_line ?? "",
            baptismDate: row.baptism_date ?? "",
            baptismStatus: row.baptism_status,
            maritalStatus: titleCase(row.marital_status),
            occupation: row.occupation ?? "",
            departmentId: row.department_members?.[0]?.department_id ?? "",
            department: row.department_members?.[0]?.departments?.name ?? "",
            membershipStatus: titleCase(row.status) as MemberStatus,
            photoUrl: row.photo_url ?? "",
            photoThumbnailUrl: row.photo_thumbnail_url ?? "",
          })));
          setLoading(false);
          return;
        }
      }
      const stored = window.localStorage.getItem(storageKey);
      setRecords(stored ? JSON.parse(stored) : seedMembers);
      setLoading(false);
    }
    loadMembers();
  }, []);

  useEffect(() => {
    if (!createClient() && records.length) window.localStorage.setItem(storageKey, JSON.stringify(records));
  }, [records]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((member) => (statusFilter === "All Statuses" || member.membershipStatus === statusFilter) && (!normalized || Object.values(member).some((value) => String(value).toLowerCase().includes(normalized))));
  }, [query, records, statusFilter]);

  function openForm(member?: MemberRecord) {
    setEditing(member ?? null);
    setForm(member ?? { ...emptyMember, memberId: `HG-${String(records.length + 1).padStart(3, "0")}` });
    setPhotoFile(null);
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyMember);
    setPhotoFile(null);
  }

  function handlePhotoFile(file: File | null) {
    if (!file) { setPhotoFile(null); return; }
    const validationError = validateMemberPhoto(file);
    if (validationError) { setError(validationError); return; }
    setError("");
    setPhotoFile(file);
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(form.memberId, "Member ID") || required(form.firstName, "First name") || required(form.lastName, "Last name") || validEmail(form.email);
    if (validationError) { setError(validationError); return; }
    if (!canManage) { setError("You have read-only access to member records."); return; }
    setSaving(true);
    const supabase = createClient();
    let saved = { ...form, id: editing?.id ?? crypto.randomUUID() };

    if (supabase) {
      const request = editing
        ? supabase.from("members").update(memberPayload(form)).eq("id", editing.id).select().single()
        : supabase.from("members").insert(memberPayload(form)).select().single();
      const { data, error } = await request;
      if (error) {
        setError(`Unable to save member: ${error.message}`);
        setSaving(false);
        return;
      }
      saved = { ...saved, id: data.id };
      if (photoFile) {
        try {
          const uploaded = await uploadMemberPhoto(supabase, saved.id, photoFile);
          saved = { ...saved, photoUrl: uploaded.photoUrl, photoThumbnailUrl: uploaded.thumbnailUrl };
        } catch (photoError) {
          setError(`Member saved, but profile photo upload failed: ${photoError instanceof Error ? photoError.message : "Unknown error"}`);
          setSaving(false);
          return;
        }
      }
      const { error: membershipDeleteError } = await supabase.from("department_members").delete().eq("member_id", saved.id);
      if (membershipDeleteError) {
        setError(`Member saved, but the department assignment could not be updated: ${membershipDeleteError.message}`);
        setSaving(false);
        return;
      }
      if (form.departmentId) {
        const department = departments.find((item) => item.id === form.departmentId);
        const { error: membershipInsertError } = await supabase.from("department_members").insert({ member_id: saved.id, department_id: form.departmentId });
        if (membershipInsertError) {
          setError(`Member saved, but the department assignment could not be updated: ${membershipInsertError.message}`);
          setSaving(false);
          return;
        }
        saved = { ...saved, departmentId: form.departmentId, department: department?.name ?? form.department };
      }
    }

    setRecords((current) => editing ? current.map((member) => member.id === editing.id ? saved : member) : [saved, ...current]);
    setNotice(editing ? "Member record updated." : "New member added.");
    setError("");
    setSaving(false);
    closeForm();
  }

  async function deleteMember(member: MemberRecord) {
    if (!canManage) { setError("You have read-only access to member records."); return; }
    if (!window.confirm(`Delete ${member.firstName} ${member.lastName}? This action cannot be undone.`)) return;
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from("members").delete().eq("id", member.id);
      if (error) {
        setError(`Unable to delete member: ${error.message}`);
        return;
      }
    }
    setRecords((current) => current.filter(({ id }) => id !== member.id));
    setNotice("Member record deleted.");
    setError("");
  }

  async function exportExcel() {
    const headers = ["Member ID", "First Name", "Last Name", "Gender", "Date of Birth", "Phone", "WhatsApp", "Email", "Address", "Baptism Date", "Marital Status", "Occupation", "Department", "Membership Status"];
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const rows = filtered.map((member) => row([member.memberId, member.firstName, member.lastName, member.gender, member.dateOfBirth, member.phone, member.whatsappPhone, member.email, member.address, member.baptismDate, member.maritalStatus, member.occupation, member.department, member.membershipStatus]));
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Members"><Table>${row(headers)}${rows.join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Hamburg-Ghana-SDA-Members.xls";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church - Members Directory", 14, 16);
    document.setFontSize(9);
    document.text(`Exported members: ${filtered.length}`, 14, 23);
    autoTableModule.default(document, {
      startY: 29,
      head: [["Member ID", "Name", "Phone", "Email", "Department", "Status"]],
      body: filtered.map((member) => [member.memberId, `${member.firstName} ${member.lastName}`, member.phone, member.email, member.department, member.membershipStatus]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save("Hamburg-Ghana-SDA-Members.pdf");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><PageHeading title={t("members.title")} description={t("members.description")} />{canManage && <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> {t("button.addNewMember")}</Button>}</div>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Members", value: records.length, icon: Users, tone: "bg-blue-50 text-churchblue" },
          { label: "Active Members", value: records.filter(({ membershipStatus }) => membershipStatus === "Active").length, icon: UserRoundCheck, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Departments", value: new Set(records.map(({ department }) => department).filter(Boolean)).size, icon: UserRoundPlus, tone: "bg-amber-50 text-amber-700" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card className="flex items-center gap-4 p-5" key={label}>
            <div className={`rounded-lg p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{value}</p></div>
          </Card>
        ))}
      </section>
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <Card>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row">
          <label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder={t("members.searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MemberStatus | "All Statuses")}><option>All Statuses</option>{["Active", "Inactive", "Transferred", "Deceased"].map((status) => <option key={status}>{status}</option>)}</select>
            <Button variant="outline" size="sm" onClick={exportPdf}><Download className="h-4 w-4" /> {t("button.exportPdf")}</Button>
            <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> {t("button.exportExcel")}</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Member", "Contact", "Department", "Personal Details", "Status", "Actions"].map((label) => <th className="px-5 py-3.5 font-semibold" key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {loading && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={6}>Loading members...</td></tr>}
              {filtered.map((member) => (
                <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60" key={member.id}>
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><MemberAvatar alt={`${member.firstName} ${member.lastName}`} size="sm" src={member.photoThumbnailUrl || member.photoUrl} /><div><p className="font-semibold text-navy">{member.firstName} {member.lastName}</p><p className="mt-1 text-xs text-slate-400">{member.memberId}</p></div></div></td>
                  <td className="px-5 py-4 text-slate-600"><p>{member.email}</p><p className="mt-1 text-xs text-slate-400">{member.phone}</p></td>
                  <td className="px-5 py-4 text-slate-600">{member.department || "Not assigned"}</td>
                  <td className="px-5 py-4 text-slate-600"><p>{member.gender || "Not set"} · {member.maritalStatus || "Not set"}</p><p className="mt-1 text-xs text-slate-400">{member.occupation || "Occupation not set"}</p></td>
                  <td className="px-5 py-4"><StatusBadge tone={member.membershipStatus === "Active" ? "green" : "slate"}>{member.membershipStatus}</StatusBadge></td>
                  <td className="px-5 py-4"><div className="flex flex-wrap gap-1"><Link href={`/members/${member.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /> {t("members.viewProfile")}</Button></Link>{canManage && <Button variant="ghost" size="sm" onClick={() => openForm(member)}><Pencil className="h-4 w-4" /> {t("members.editMember")}</Button>}{canManage && <Button variant="ghost" size="sm" onClick={() => deleteMember(member)}><Trash2 className="h-4 w-4 text-rose-600" /> {t("members.deleteMember")}</Button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="px-5 py-12 text-center text-sm text-slate-500">No members match your search.</p>}
        </div>
      </Card>
      {form.memberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={saveMember}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 className="font-bold text-navy">{editing ? "Edit Member" : "Add Member"}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church membership record</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close member form" onClick={closeForm}><X className="h-5 w-5" /></Button></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Member ID", "memberId", "text"], ["First Name", "firstName", "text"], ["Last Name", "lastName", "text"],
                ["Date of Birth", "dateOfBirth", "date"], ["Phone", "phone", "tel"], ["WhatsApp Number", "whatsappPhone", "tel"], ["Email", "email", "email"],
                ["Baptism Date", "baptismDate", "date"], ["Occupation", "occupation", "text"],
              ].map(([label, key, type]) => <label className="text-sm font-semibold text-slate-700" key={key}>{label}<input className={fieldClass} type={type} value={String(form[key as keyof MemberRecord])} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={["memberId", "firstName", "lastName"].includes(key)} /></label>)}
              {[ 
                ["Gender", "gender", ["", "Male", "Female", "Other", "Prefer Not To Say"]],
                ["Marital Status", "maritalStatus", ["", "Single", "Married", "Divorced", "Widowed", "Other"]],
                ["Membership Status", "membershipStatus", ["Active", "Inactive", "Transferred", "Deceased"]],
              ].map(([label, key, options]) => <label className="text-sm font-semibold text-slate-700" key={String(key)}>{label}<select className={fieldClass} value={String(form[key as keyof MemberRecord])} onChange={(event) => setForm({ ...form, [String(key)]: event.target.value })}>{(options as string[]).map((option) => <option key={option} value={option}>{option || "Select option"}</option>)}</select></label>)}
              <label className="text-sm font-semibold text-slate-700">Department<select className={fieldClass} value={form.departmentId} onChange={(event) => { const department = departments.find((item) => item.id === event.target.value); setForm({ ...form, departmentId: event.target.value, department: department?.name ?? "" }); }}><option value="">Not assigned</option>{departments.map((department) => <option disabled={!department.isActive && department.id !== form.departmentId} key={department.id} value={department.id}>{department.name}{department.isActive ? "" : " (Inactive)"}</option>)}</select></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Profile Photo<input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-churchblue" type="file" onChange={(event) => handlePhotoFile(event.target.files?.[0] ?? null)} /><span className="mt-1 block text-xs font-normal text-slate-400">JPG, JPEG, PNG, or WEBP. Profile photo must be 4 MB or smaller. A thumbnail is generated automatically.</span></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Address<input className={fieldClass} type="text" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.baptismStatus} onChange={(event) => setForm({ ...form, baptismStatus: event.target.checked })} /> Baptized member</label>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4"><Button type="button" variant="outline" onClick={closeForm}>{t("button.cancel")}</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : editing ? "Save Changes" : t("button.addNewMember")}</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}
