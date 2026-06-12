"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { jsPDF as JsPDFDocument } from "jspdf";
import {
  Download, Eye, FileSpreadsheet, IdCard, Pencil, Plus, Printer, QrCode, Search, Trash2, UserRoundCheck,
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
import { fallbackChurchProfile, loadPublicChurchProfile, type ChurchProfile } from "@/lib/church-profile";
import { normalizeRoles } from "@/lib/auth";

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
  const [canGenerateCards, setCanGenerateCards] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "All Statuses">("All Statuses");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [churchProfile, setChurchProfile] = useState<ChurchProfile>(fallbackChurchProfile);
  const [cardMember, setCardMember] = useState<MemberRecord | null>(null);
  const [cardDepartmentId, setCardDepartmentId] = useState("");

  useEffect(() => {
    async function loadMembers() {
      const supabase = createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          const roleNames = normalizeRoles((roleRows ?? []).map(({ role }) => role));
          setCanManage(roleNames.some((role) => ["super_admin", "pastor", "elder", "church_clerk", "secretary"].includes(role)));
          setCanGenerateCards(roleNames.some((role) => ["super_admin", "secretary"].includes(role)));
        }
        const [{ data, error: loadError }, { data: departmentRows }, profile] = await Promise.all([
          supabase.from("members").select("*, department_members(department_id, departments(name, is_active))").order("last_name"),
          supabase.from("departments").select("id, name, is_active").order("name"),
          loadPublicChurchProfile(supabase),
        ]);
        setChurchProfile(profile);
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
      setCanGenerateCards(true);
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
    setError("");
    setNotice("");
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
    setError("");
    setNotice("");
    setSaving(true);
    const supabase = createClient();
    let saved = { ...form, id: editing?.id ?? crypto.randomUUID() };

    try {
      if (supabase) {
        const request = editing
          ? supabase.from("members").update(memberPayload(form)).eq("id", editing.id).select().single()
          : supabase.from("members").insert(memberPayload(form)).select().single();
        const { data, error } = await request;
        if (error) {
          console.error("Unable to save member", error);
          setError(`Unable to save member: ${error.message}`);
          return;
        }
        saved = {
          ...saved,
          id: data.id,
          photoUrl: data.photo_url ?? saved.photoUrl,
          photoThumbnailUrl: data.photo_thumbnail_url ?? saved.photoThumbnailUrl,
        };
        if (photoFile) {
          try {
            const uploaded = await uploadMemberPhoto(supabase, saved.id, photoFile);
            saved = { ...saved, photoUrl: uploaded.photoUrl, photoThumbnailUrl: uploaded.thumbnailUrl };
          } catch (photoError) {
            console.error("Unable to upload member photo", photoError);
            setError(`Member saved, but profile photo upload failed: ${photoError instanceof Error ? photoError.message : "Unknown error"}`);
            return;
          }
        }

        const departmentChanged = editing ? editing.departmentId !== form.departmentId : Boolean(form.departmentId);
        if (departmentChanged) {
          const { error: membershipDeleteError } = await supabase.from("department_members").delete().eq("member_id", saved.id);
          if (membershipDeleteError) {
            console.error("Unable to update member department assignment", membershipDeleteError);
            setError(`Member details were saved, but the department assignment could not be updated: ${membershipDeleteError.message}`);
            return;
          }
          if (form.departmentId) {
            const department = departments.find((item) => item.id === form.departmentId);
            const { error: membershipInsertError } = await supabase.from("department_members").insert({ member_id: saved.id, department_id: form.departmentId });
            if (membershipInsertError) {
              console.error("Unable to update member department assignment", membershipInsertError);
              setError(`Member details were saved, but the department assignment could not be updated: ${membershipInsertError.message}`);
              return;
            }
            saved = { ...saved, departmentId: form.departmentId, department: department?.name ?? form.department };
          } else {
            saved = { ...saved, departmentId: "", department: "" };
          }
        }
      }

      setRecords((current) => editing ? current.map((member) => member.id === editing.id ? saved : member) : [saved, ...current]);
      setNotice(editing ? "Member record updated." : "New member added.");
      setError("");
      closeForm();
    } catch (saveError) {
      console.error("Unable to save member", saveError);
      setError(`Unable to save member: ${saveError instanceof Error ? saveError.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
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

  function memberFullName(member: MemberRecord) {
    return `${member.firstName} ${member.lastName}`.trim();
  }

  function initialsFromText(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return (parts.length ? parts : ["HG"]).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  }

  function issueDate() {
    return new Date().toLocaleDateString("en-GB");
  }

  function expiryYear() {
    return String(new Date().getFullYear() + 2);
  }

  function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  }

  function imageFormat(dataUrl: string) {
    return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
  }

  function memberLookupUrl(member: MemberRecord) {
    const baseUrl = typeof window === "undefined" ? "https://hamburg-ghana-sda-management.vercel.app" : window.location.origin;
    return `${baseUrl}/members/lookup/${encodeURIComponent(member.memberId)}`;
  }

  function qrImageUrl(member: MemberRecord, size = 220) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(memberLookupUrl(member))}`;
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

  async function drawMemberCard(document: JsPDFDocument, member: MemberRecord, x: number, y: number, width: number, height: number) {
    const name = memberFullName(member);
    const [logoData, photoData, qrData] = await Promise.all([
      imageToDataUrl(churchProfile.logo_url),
      imageToDataUrl(member.photoThumbnailUrl || member.photoUrl),
      imageToDataUrl(qrImageUrl(member, 220)),
    ]);
    const cardRight = x + width;
    const cardBottom = y + height;
    document.setFillColor(8, 41, 76);
    document.roundedRect(x, y, width, height, 4, 4, "F");
    document.setFillColor(255, 255, 255);
    document.roundedRect(x + 1.2, y + 1.2, width - 2.4, height - 2.4, 3.2, 3.2, "F");
    document.setFillColor(8, 41, 76);
    document.roundedRect(x + 1.2, y + 1.2, width - 2.4, 14, 3.2, 3.2, "F");
    document.setFillColor(240, 193, 90);
    document.rect(x + 1.2, y + 13, width - 2.4, 2.2, "F");
    if (logoData) {
      document.addImage(logoData, imageFormat(logoData), x + 5, y + 3.8, 9, 9);
    } else {
      document.setFillColor(255, 255, 255);
      document.circle(x + 9.5, y + 8.2, 4.4, "F");
      document.setTextColor(8, 41, 76);
      document.setFontSize(4.8);
      document.text(initialsFromText(churchProfile.short_name), x + 9.5, y + 9.7, { align: "center" });
    }
    document.setTextColor(255, 255, 255);
    document.setFontSize(7.2);
    document.text(churchProfile.church_name, x + 17, y + 7.5, { maxWidth: width - 44 });
    document.setFontSize(4.8);
    document.text("MEMBER ID CARD", x + 17, y + 12.2);
    document.setTextColor(240, 193, 90);
    document.setFontSize(5);
    document.text(member.memberId, cardRight - 6, y + 9.4, { align: "right" });

    const photoX = x + 5;
    const photoY = y + 20;
    const photoSize = 22;
    document.setFillColor(226, 232, 240);
    document.roundedRect(photoX, photoY, photoSize, photoSize, 3, 3, "F");
    if (photoData) {
      document.addImage(photoData, imageFormat(photoData), photoX, photoY, photoSize, photoSize);
    } else {
      document.setTextColor(8, 41, 76);
      document.setFontSize(9);
      document.text(initialsFromText(name), photoX + photoSize / 2, photoY + 13, { align: "center" });
    }

    document.setTextColor(8, 41, 76);
    document.setFontSize(9.5);
    document.text(name, x + 31, y + 23, { maxWidth: width - 57 });
    document.setTextColor(37, 99, 235);
    document.setFontSize(6.3);
    document.text(member.memberId, x + 31, y + 28);
    [["Department", member.department || "Not assigned"], ["Status", member.membershipStatus], ["Phone", member.phone || "-"], ["Email", member.email || "-"]].forEach(([label, value], index) => {
      const rowY = y + 34 + index * 4.7;
      document.setTextColor(100, 116, 139);
      document.setFontSize(4.4);
      document.text(label.toUpperCase(), x + 31, rowY);
      document.setTextColor(8, 41, 76);
      document.setFontSize(5.2);
      document.text(value, x + 48, rowY, { maxWidth: 16 });
    });
    if (qrData) document.addImage(qrData, "PNG", cardRight - 24, y + 21, 18, 18);
    document.setTextColor(100, 116, 139);
    document.setFontSize(4.3);
    document.text("SCAN TO VERIFY", cardRight - 15, y + 42, { align: "center" });

    document.setFillColor(248, 250, 252);
    document.rect(x + 1.2, cardBottom - 8.5, width - 2.4, 7.3, "F");
    document.setTextColor(100, 116, 139);
    document.setFontSize(4.6);
    document.text(`Issued: ${issueDate()}`, x + 5, cardBottom - 5);
    document.text(`Expires: ${expiryYear()}`, x + 31, cardBottom - 5);
    document.text("If found, please return to Hamburg Ghana SDA Church", x + 5, cardBottom - 2.3, { maxWidth: width - 12 });
  }

  async function downloadMemberCardPdf(member: MemberRecord) {
    const { jsPDF } = await import("jspdf");
    const document = new jsPDF({ orientation: "landscape", unit: "mm", format: [86, 54] });
    await drawMemberCard(document, member, 0, 0, 86, 54);
    document.save(`${member.memberId}-ID-Card.pdf`);
  }

  async function downloadBulkCardsPdf(members: MemberRecord[], filename: string) {
    if (!members.length) { setError("No active members found for ID card export."); return; }
    const { jsPDF } = await import("jspdf");
    const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const cardWidth = 86;
    const cardHeight = 54;
    const marginX = 14;
    const marginY = 14;
    const gapX = 10;
    const gapY = 8;
    const cardsPerPage = 8;
    for (const [index, member] of members.entries()) {
      if (index > 0 && index % cardsPerPage === 0) document.addPage("a4", "portrait");
      const slot = index % cardsPerPage;
      const column = slot % 2;
      const row = Math.floor(slot / 2);
      await drawMemberCard(document, member, marginX + column * (cardWidth + gapX), marginY + row * (cardHeight + gapY), cardWidth, cardHeight);
    }
    document.save(filename);
  }

  function printMemberCard(member: MemberRecord) {
    const printWindow = window.open("", "_blank", "width=420,height=620");
    if (!printWindow) return;
    const name = memberFullName(member);
    const logo = churchProfile.logo_url ? `<img class="logo" src="${escapeHtml(churchProfile.logo_url)}" alt="">` : `<div class="logo fallback">${escapeHtml(initialsFromText(churchProfile.short_name))}</div>`;
    const photo = member.photoThumbnailUrl || member.photoUrl ? `<img class="photo" src="${escapeHtml(member.photoThumbnailUrl || member.photoUrl)}" alt="">` : `<div class="photo fallback">${escapeHtml(initialsFromText(name))}</div>`;
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(member.memberId)} ID Card</title><style>@page{size:86mm 54mm;margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:white}.card{width:86mm;height:54mm;overflow:hidden;border-radius:4mm;border:1mm solid #08294c;background:white;color:#08294c;position:relative}.head{height:15mm;background:#08294c;color:white;display:grid;grid-template-columns:12mm 1fr auto;gap:3mm;align-items:center;padding:2.5mm 4mm;border-bottom:2mm solid #f0c15a}.logo{width:9mm;height:9mm;border-radius:2mm;background:white;object-fit:contain;padding:1mm}.logo.fallback{display:flex;align-items:center;justify-content:center;color:#08294c;font-weight:900;font-size:7px}.church{font-size:7.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;line-height:1.1}.kind{font-size:6px;color:#f0c15a;font-weight:800;margin-top:1mm}.number{font-size:7px;color:#f0c15a;font-weight:900}.body{display:grid;grid-template-columns:22mm 1fr 20mm;gap:3mm;padding:4mm}.photo{width:22mm;height:22mm;border-radius:3mm;background:#e2e8f0;object-fit:cover}.photo.fallback{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#08294c}.name{font-size:12px;font-weight:900;line-height:1.05;margin-bottom:1.5mm}.mid{font-size:7px;color:#2563eb;font-weight:900;margin-bottom:2mm}.label{font-size:4.8px;text-transform:uppercase;color:#64748b;font-weight:800}.value{font-size:6.3px;font-weight:800;margin:.3mm 0 1.2mm;line-height:1.05}.qr{width:18mm;height:18mm;border:0.4mm solid #e2e8f0;border-radius:2mm;padding:1mm}.scan{font-size:4.5px;color:#64748b;font-weight:800;text-align:center;margin-top:1mm}.foot{position:absolute;left:0;right:0;bottom:0;height:8mm;background:#f8fafc;padding:1.3mm 4mm;font-size:4.8px;color:#64748b}.return{margin-top:.5mm}@media print{.card{box-shadow:none}}</style></head><body><section class="card"><div class="head">${logo}<div><div class="church">${escapeHtml(churchProfile.church_name)}</div><div class="kind">Member ID Card</div></div><div class="number">${escapeHtml(member.memberId)}</div></div><div class="body">${photo}<div><div class="name">${escapeHtml(name)}</div><div class="mid">${escapeHtml(member.memberId)}</div><div class="label">Department</div><div class="value">${escapeHtml(member.department || "Not assigned")}</div><div class="label">Status</div><div class="value">${escapeHtml(member.membershipStatus)}</div><div class="label">Phone</div><div class="value">${escapeHtml(member.phone || "-")}</div><div class="label">Email</div><div class="value">${escapeHtml(member.email || "-")}</div></div><div><img class="qr" src="${escapeHtml(qrImageUrl(member, 220))}" alt="QR"><div class="scan">SCAN TO VERIFY</div></div></div><div class="foot"><span>Issued: ${escapeHtml(issueDate())}</span><span style="margin-left:8mm">Expires: ${escapeHtml(expiryYear())}</span><div class="return">If found, please return to Hamburg Ghana SDA Church</div></div></section><script>window.onload=()=>{window.print();}</script></body></html>`);
    printWindow.document.close();
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
        {canGenerateCards && <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-end"><Button size="sm" variant="outline" onClick={() => void downloadBulkCardsPdf(records.filter((member) => member.membershipStatus === "Active"), "Hamburg-Ghana-SDA-Active-Member-ID-Cards.pdf")}><IdCard className="h-4 w-4" /> Generate Active ID Cards</Button><select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600" value={cardDepartmentId} onChange={(event) => setCardDepartmentId(event.target.value)}><option value="">Select department for ID cards</option>{departments.filter((department) => department.isActive).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><Button disabled={!cardDepartmentId} size="sm" variant="outline" onClick={() => { const department = departments.find((item) => item.id === cardDepartmentId); void downloadBulkCardsPdf(records.filter((member) => member.membershipStatus === "Active" && member.departmentId === cardDepartmentId), `${department?.name.replaceAll(" ", "-") || "Department"}-Member-ID-Cards.pdf`); }}><IdCard className="h-4 w-4" /> Generate Department ID Cards</Button></div>}
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
                  <td className="px-5 py-4"><div className="flex flex-wrap gap-1"><Link href={`/members/${member.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /> {t("members.viewProfile")}</Button></Link>{canGenerateCards && <Button variant="ghost" size="sm" onClick={() => setCardMember(member)}><IdCard className="h-4 w-4" /> View ID Card</Button>}{canGenerateCards && <Button variant="ghost" size="sm" onClick={() => void downloadMemberCardPdf(member)}><Download className="h-4 w-4" /> ID PDF</Button>}{canGenerateCards && <Button variant="ghost" size="sm" onClick={() => printMemberCard(member)}><Printer className="h-4 w-4" /> Print</Button>}{canManage && <Button variant="ghost" size="sm" onClick={() => openForm(member)}><Pencil className="h-4 w-4" /> {t("members.editMember")}</Button>}{canManage && <Button variant="ghost" size="sm" onClick={() => deleteMember(member)}><Trash2 className="h-4 w-4 text-rose-600" /> {t("members.deleteMember")}</Button>}</div></td>
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
            {error && <div className="mx-5 mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
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
      {cardMember && <MemberIdCardModal church={churchProfile} lookupUrl={memberLookupUrl(cardMember)} member={cardMember} qrUrl={qrImageUrl(cardMember)} onClose={() => setCardMember(null)} onDownload={() => void downloadMemberCardPdf(cardMember)} onPrint={() => printMemberCard(cardMember)} />}
    </div>
  );
}

function MemberIdCardModal({ member, church, lookupUrl, qrUrl, onClose, onDownload, onPrint }: { member: MemberRecord; church: ChurchProfile; lookupUrl: string; qrUrl: string; onClose: () => void; onDownload: () => void; onPrint: () => void }) {
  const fullName = `${member.firstName} ${member.lastName}`.trim();
  const churchInitials = church.short_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "HG";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 print:hidden"><div><h2 className="font-bold text-navy">Member ID Card</h2><p className="mt-1 text-xs text-slate-400">{member.memberId}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close ID card" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="p-5"><section className="mx-auto aspect-[86/54] w-full max-w-[540px] overflow-hidden rounded-2xl border-[6px] border-navy-deep bg-white shadow-lg"><div className="grid h-[28%] grid-cols-[3rem_1fr_auto] items-center gap-3 border-b-4 border-gold bg-navy-deep px-4 text-white">{church.logo_url ? <object aria-label={`${church.church_name} logo`} className="h-10 w-10 rounded-md bg-white object-contain p-1" data={church.logo_url} type="image/png"><span className="flex h-full w-full items-center justify-center text-xs font-black text-navy">{churchInitials}</span></object> : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-xs font-black text-navy">{churchInitials}</div>}<div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-[0.16em] text-white">{church.church_name}</p><p className="mt-1 text-xs font-bold text-gold">Member ID Card</p></div><p className="text-xs font-black text-gold">{member.memberId}</p></div><div className="grid h-[72%] grid-cols-[5.25rem_1fr_5.5rem] gap-3 px-4 py-3"><MemberAvatar alt={fullName} className="h-20 w-20 rounded-lg" size="lg" src={member.photoThumbnailUrl || member.photoUrl} /><div className="min-w-0"><h3 className="truncate text-xl font-black leading-tight text-navy">{fullName}</h3><p className="mt-0.5 text-sm font-black text-churchblue">{member.memberId}</p><div className="mt-2 grid grid-cols-[4.5rem_1fr] gap-y-1 text-xs"><span className="font-black uppercase text-slate-400">Department</span><span className="truncate font-bold text-navy">{member.department || "Not assigned"}</span><span className="font-black uppercase text-slate-400">Status</span><span className="font-bold text-navy">{member.membershipStatus}</span><span className="font-black uppercase text-slate-400">Phone</span><span className="truncate font-bold text-navy">{member.phone || "-"}</span><span className="font-black uppercase text-slate-400">Email</span><span className="truncate font-bold text-navy">{member.email || "-"}</span></div></div><div className="flex flex-col items-center justify-start"><object aria-label={`QR code for ${member.memberId}`} className="h-[4.5rem] w-[4.5rem] rounded-lg border border-slate-100 p-1" data={qrUrl} type="image/png"><QrCode className="h-14 w-14 text-slate-300" /></object><p className="mt-1 text-[9px] font-black uppercase text-slate-400">Scan to verify</p></div><div className="col-span-3 grid grid-cols-[auto_auto_1fr] gap-3 border-t border-slate-100 pt-1 text-[10px] font-bold text-slate-500"><span>Issued: {new Date().toLocaleDateString("en-GB")}</span><span>Expires: {new Date().getFullYear() + 2}</span><span className="truncate text-right">If found, please return to Hamburg Ghana SDA Church</span></div></div></section><p className="mx-auto mt-3 max-w-[540px] truncate text-center text-[10px] text-slate-400">{lookupUrl}</p><div className="mt-5 flex flex-wrap justify-end gap-2 print:hidden"><Button variant="outline" onClick={onDownload}><Download className="h-4 w-4" /> Download ID Card PDF</Button><Button variant="outline" onClick={onPrint}><Printer className="h-4 w-4" /> Print ID Card</Button><Button onClick={onClose}>Done</Button></div></div></div></div>;
}
