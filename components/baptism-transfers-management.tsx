"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, BookOpenCheck, CheckCircle2, Church, Download, FileSpreadsheet, Pencil, Plus, RefreshCw, Search, Trash2, Upload, UserCheck, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles } from "@/lib/auth";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type ModuleKey = "candidates" | "classes" | "baptisms" | "transferIn" | "transferOut" | "profession";
type FieldType = "text" | "date" | "number" | "textarea" | "select" | "candidate" | "candidate_multi" | "file";
type FieldConfig = { key: string; label: string; type?: FieldType; options?: { value: string; label: string }[]; required?: boolean };
type ModuleConfig = {
  key: ModuleKey;
  title: string;
  description: string;
  table: string;
  orderColumn: string;
  icon: typeof Church;
  fields: FieldConfig[];
  columns: { key: string; label: string }[];
};
type ModuleRecord = { id: string; module: ModuleKey; data: Record<string, string> };
type CandidateOption = { id: string; label: string; name: string };
type ClassAssignment = Record<string, string[]>;
type ClassAttendanceCount = Record<string, number>;

const candidateStatuses = [
  { value: "studying", label: "Studying" },
  { value: "ready_for_baptism", label: "Ready for Baptism" },
  { value: "baptized", label: "Baptized" },
];
const transferStatuses = [
  { value: "requested", label: "Requested" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "received", label: "Received" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const approvalStatuses = [
  { value: "requested", label: "Requested" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];
const genderOptions = [
  { value: "Female", label: "Female" },
  { value: "Male", label: "Male" },
  { value: "Other", label: "Other" },
];

const modules: ModuleConfig[] = [
  {
    key: "candidates",
    title: "Baptism Candidates",
    description: "Candidate records, Bible instructor assignment, class start date, and baptism readiness.",
    table: "baptism_candidates",
    orderColumn: "created_at",
    icon: Users,
    fields: [
      { key: "candidate_id", label: "Candidate ID" },
      { key: "full_name", label: "Full Name", required: true },
      { key: "date_of_birth", label: "Date of Birth", type: "date" },
      { key: "gender", label: "Gender", type: "select", options: genderOptions },
      { key: "phone_number", label: "Phone Number" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "bible_instructor", label: "Bible Instructor" },
      { key: "baptismal_class_start_date", label: "Baptismal Class Start Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: candidateStatuses, required: true },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "candidate_id", label: "Candidate ID" },
      { key: "full_name", label: "Full Name" },
      { key: "bible_instructor", label: "Bible Instructor" },
      { key: "baptismal_class_start_date", label: "Class Start" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "classes",
    title: "Baptism Classes",
    description: "Class schedule, instructor, lesson progress, and notes.",
    table: "baptism_classes",
    orderColumn: "start_date",
    icon: BookOpenCheck,
    fields: [
      { key: "class_name", label: "Class Name", required: true },
      { key: "instructor", label: "Instructor" },
      { key: "start_date", label: "Start Date", type: "date" },
      { key: "end_date", label: "End Date", type: "date" },
      { key: "lessons_completed", label: "Lessons Completed", type: "number" },
      { key: "candidate_ids", label: "Candidates in Class", type: "candidate_multi" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "class_name", label: "Class Name" },
      { key: "instructor", label: "Instructor" },
      { key: "start_date", label: "Start Date" },
      { key: "end_date", label: "End Date" },
      { key: "lessons_completed", label: "Lessons" },
      { key: "candidate_ids", label: "Candidates" },
    ],
  },
  {
    key: "baptisms",
    title: "Baptism Records",
    description: "Official baptism records, witnesses, location, pastor, and certificate number.",
    table: "baptism_records",
    orderColumn: "baptism_date",
    icon: Church,
    fields: [
      { key: "baptism_date", label: "Baptism Date", type: "date", required: true },
      { key: "pastor", label: "Pastor", required: true },
      { key: "location", label: "Location" },
      { key: "candidate_record_id", label: "Candidate", type: "candidate" },
      { key: "candidate_name", label: "Candidate Name" },
      { key: "witnesses", label: "Witnesses", type: "textarea" },
      { key: "certificate_number", label: "Certificate Number", required: true },
      { key: "member_id", label: "Converted Member ID" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "baptism_date", label: "Date" },
      { key: "candidate_name", label: "Candidate" },
      { key: "pastor", label: "Pastor" },
      { key: "location", label: "Location" },
      { key: "certificate_number", label: "Certificate" },
      { key: "member_id", label: "Member Link" },
    ],
  },
  {
    key: "transferIn",
    title: "Membership Transfer In",
    description: "Incoming transfer requests from previous churches and conferences.",
    table: "membership_transfer_in",
    orderColumn: "request_date",
    icon: RefreshCw,
    fields: [
      { key: "member_name", label: "Member Name", required: true },
      { key: "previous_church", label: "Previous Church", required: true },
      { key: "conference", label: "Conference" },
      { key: "request_date", label: "Request Date", type: "date" },
      { key: "transfer_received_date", label: "Transfer Received Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: transferStatuses, required: true },
      { key: "approval_status", label: "Approval Status", type: "select", options: approvalStatuses },
      { key: "transfer_letter_url", label: "Transfer Letter Upload", type: "file" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "member_name", label: "Member" },
      { key: "previous_church", label: "Previous Church" },
      { key: "conference", label: "Conference" },
      { key: "request_date", label: "Request Date" },
      { key: "status", label: "Status" },
      { key: "approval_status", label: "Approval" },
    ],
  },
  {
    key: "transferOut",
    title: "Membership Transfer Out",
    description: "Outgoing transfer requests to destination churches and conferences.",
    table: "membership_transfer_out",
    orderColumn: "request_date",
    icon: RefreshCw,
    fields: [
      { key: "member_name", label: "Member Name", required: true },
      { key: "destination_church", label: "Destination Church", required: true },
      { key: "conference", label: "Conference" },
      { key: "request_date", label: "Request Date", type: "date" },
      { key: "approval_date", label: "Approval Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: transferStatuses, required: true },
      { key: "approval_status", label: "Approval Status", type: "select", options: approvalStatuses },
      { key: "transfer_request_url", label: "Transfer Request Upload", type: "file" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "member_name", label: "Member" },
      { key: "destination_church", label: "Destination Church" },
      { key: "conference", label: "Conference" },
      { key: "request_date", label: "Request Date" },
      { key: "status", label: "Status" },
      { key: "approval_status", label: "Approval" },
    ],
  },
  {
    key: "profession",
    title: "Profession of Faith",
    description: "Profession of faith records for incoming or returning members.",
    table: "profession_of_faith_records",
    orderColumn: "profession_date",
    icon: BadgeCheck,
    fields: [
      { key: "member_name", label: "Member Name", required: true },
      { key: "profession_date", label: "Date", type: "date", required: true },
      { key: "pastor", label: "Pastor" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "member_name", label: "Member" },
      { key: "profession_date", label: "Date" },
      { key: "pastor", label: "Pastor" },
      { key: "notes", label: "Notes" },
    ],
  },
];

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function labelFor(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? fullName,
    lastName: parts.slice(1).join(" ") || "",
  };
}

function normalizeRow(module: ModuleKey, row: Record<string, unknown>): ModuleRecord {
  const data = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)]));
  return { id: String(row.id), module, data };
}

function emptyForm(config: ModuleConfig) {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.options?.[0]?.value ?? ""]));
}

function selectedIds(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function serializeIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))].join(",");
}

function nextCandidateId(records: ModuleRecord[]) {
  const next = records.reduce((max, record) => {
    const match = /^BC-(\d+)$/i.exec(record.data.candidate_id ?? "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `BC-${String(next).padStart(3, "0")}`;
}

function nextMemberNumber(existingNumbers: string[]) {
  const next = existingNumbers.reduce((max, value) => {
    const match = /^HG-(\d+)$/i.exec(value ?? "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `HG-${String(next).padStart(3, "0")}`;
}

function payloadFrom(form: Record<string, string>, userId?: string) {
  return Object.fromEntries(
    Object.entries({ ...form, updated_by: userId ?? null }).filter(([key]) => !["candidate_ids"].includes(key)).map(([key, value]) => {
      if (value === "") return [key, null];
      if (key === "lessons_completed") return [key, Number(value || 0)];
      return [key, value];
    }),
  );
}

function statusTone(value: string) {
  if (["baptized", "completed", "received", "approved"].includes(value)) return "green";
  if (["ready_for_baptism", "in_review"].includes(value)) return "gold";
  if (["cancelled"].includes(value)) return "red";
  return "blue";
}

function safeFileName(file: File) {
  return file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function BaptismTransfersManagement() {
  const [activeKey, setActiveKey] = useState<ModuleKey>("candidates");
  const [records, setRecords] = useState<Record<ModuleKey, ModuleRecord[]>>({ candidates: [], classes: [], baptisms: [], transferIn: [], transferOut: [], profession: [] });
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [form, setForm] = useState<Record<string, string>>({});
  const [classAssignments, setClassAssignments] = useState<ClassAssignment>({});
  const [classAttendanceCounts, setClassAttendanceCounts] = useState<ClassAttendanceCount>({});
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<ModuleRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(!createClient());

  const activeModule = modules.find((module) => module.key === activeKey) ?? modules[0];
  const activeRecords = useMemo(() => records[activeKey] ?? [], [activeKey, records]);
  const activeStatusOptions = activeModule.fields.find((field) => field.key === "status")?.options ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activeRecords.filter((record) => {
      const matchesStatus = status === "All Statuses" || record.data.status === status;
      const matchesQuery = !needle || Object.values(record.data).some((value) => value.toLowerCase().includes(needle));
      return matchesStatus && matchesQuery;
    });
  }, [activeRecords, query, status]);

  const summary = useMemo(() => {
    const candidateRows = records.candidates;
    const currentYear = String(new Date().getFullYear());
    return [
      { label: "Candidates Studying", value: candidateRows.filter((record) => record.data.status === "studying").length, icon: Users },
      { label: "Ready for Baptism", value: candidateRows.filter((record) => record.data.status === "ready_for_baptism").length, icon: UserCheck },
      { label: "Baptized This Year", value: records.baptisms.filter((record) => record.data.baptism_date?.startsWith(currentYear)).length, icon: Church },
      { label: "Incoming Transfers", value: records.transferIn.length, icon: RefreshCw },
      { label: "Outgoing Transfers", value: records.transferOut.length, icon: RefreshCw },
    ];
  }, [records]);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
      setCanManage(roles.some((role) => ["super_admin", "pastor", "elder", "church_clerk", "secretary"].includes(role)));
    }

    const results = await Promise.all(modules.map((module) => supabase.from(module.table).select("*").order(module.orderColumn, { ascending: false, nullsFirst: false })));
    const [assignmentResult, attendanceResult] = await Promise.all([
      supabase.from("baptism_class_candidates").select("class_id, candidate_id"),
      supabase.from("baptism_class_attendance").select("class_id"),
    ]);
    const nextRecords = { candidates: [], classes: [], baptisms: [], transferIn: [], transferOut: [], profession: [] } as Record<ModuleKey, ModuleRecord[]>;
    results.forEach((result, index) => {
      const config = modules[index];
      if (result.error) {
        setError((current) => current || `Unable to load ${config.title}: ${result.error.message}. Apply migration 202606090009_baptism_membership_transfers.sql in Supabase.`);
        return;
      }
      nextRecords[config.key] = (result.data ?? []).map((row) => normalizeRow(config.key, row as Record<string, unknown>));
    });
    if (!assignmentResult.error) {
      const assignments = (assignmentResult.data ?? []).reduce<ClassAssignment>((acc, row) => {
        acc[row.class_id] = [...(acc[row.class_id] ?? []), row.candidate_id];
        return acc;
      }, {});
      setClassAssignments(assignments);
      nextRecords.classes = nextRecords.classes.map((record) => ({ ...record, data: { ...record.data, candidate_ids: serializeIds(assignments[record.id] ?? []) } }));
    }
    if (!attendanceResult.error) {
      setClassAttendanceCounts((attendanceResult.data ?? []).reduce<ClassAttendanceCount>((acc, row) => {
        acc[row.class_id] = (acc[row.class_id] ?? 0) + 1;
        return acc;
      }, {}));
    }
    setRecords(nextRecords);
    setCandidates(nextRecords.candidates.map((record) => ({ id: record.id, name: record.data.full_name, label: `${record.data.full_name} (${record.data.candidate_id})` })));
    setLoading(false);
  }

  function openForm(record?: ModuleRecord) {
    if (!canManage) {
      setError("Only Super Admin, Pastor, Elder, Church Clerk, or Secretary can manage baptism and transfer records.");
      return;
    }
    const config = record ? modules.find((module) => module.key === record.module) ?? activeModule : activeModule;
    setActiveKey(config.key);
    setEditing(record ?? null);
    const nextForm = record ? { ...emptyForm(config), ...record.data } : emptyForm(config);
    if (record?.module === "classes") nextForm.candidate_ids = serializeIds(classAssignments[record.id] ?? selectedIds(record.data.candidate_ids ?? ""));
    setForm(nextForm);
    setTransferFile(null);
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm({});
    setTransferFile(null);
  }

  async function uploadTransferDocument(supabase: NonNullable<ReturnType<typeof createClient>>, file: File, folder: string) {
    const path = `${folder}/${crypto.randomUUID()}-${safeFileName(file)}`;
    const { error: uploadError } = await supabase.storage.from("transfer-letters").upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("transfer-letters").getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function syncClassCandidates(supabase: NonNullable<ReturnType<typeof createClient>>, classId: string, ids: string[], userId?: string) {
    const { error: deleteError } = await supabase.from("baptism_class_candidates").delete().eq("class_id", classId);
    if (deleteError) throw deleteError;
    if (!ids.length) return;
    const lessonsCompleted = Number(form.lessons_completed || 0);
    const { error: insertError } = await supabase.from("baptism_class_candidates").insert(ids.map((candidateId) => ({
      class_id: classId,
      candidate_id: candidateId,
      progress_status: "studying",
      lessons_completed: lessonsCompleted,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })));
    if (insertError) throw insertError;
  }

  async function convertCandidateToMember(supabase: NonNullable<ReturnType<typeof createClient>>, baptism: ModuleRecord, userId?: string) {
    if (!baptism.data.candidate_record_id || baptism.data.member_id) return "";
    const candidate = records.candidates.find((record) => record.id === baptism.data.candidate_record_id);
    if (!candidate) return "";

    const { data: existingMember } = await supabase
      .from("members")
      .select("id")
      .eq("full_name", candidate.data.full_name)
      .maybeSingle();
    if (existingMember?.id) {
      await supabase.from("baptism_records").update({ member_id: existingMember.id, updated_by: userId ?? null }).eq("id", baptism.id);
      await supabase.from("baptism_candidates").update({ status: "baptized", updated_by: userId ?? null }).eq("id", candidate.id);
      return existingMember.id;
    }

    const { data: memberNumbers } = await supabase.from("members").select("member_number");
    const { firstName, lastName } = splitName(candidate.data.full_name);
    const { data: member, error: memberError } = await supabase
      .from("members")
      .insert({
        member_number: nextMemberNumber((memberNumbers ?? []).map((row) => row.member_number ?? "")),
        full_name: candidate.data.full_name,
        first_name: firstName,
        last_name: lastName,
        gender: candidate.data.gender?.toLowerCase() || null,
        date_of_birth: candidate.data.date_of_birth || null,
        phone: candidate.data.phone_number || null,
        address_line: candidate.data.address || null,
        baptism_date: baptism.data.baptism_date || null,
        baptism_status: true,
        status: "active",
      })
      .select("id")
      .single();
    if (memberError) throw memberError;
    await supabase.from("baptism_records").update({ member_id: member.id, updated_by: userId ?? null }).eq("id", baptism.id);
    await supabase.from("baptism_candidates").update({ status: "baptized", updated_by: userId ?? null }).eq("id", candidate.id);
    return member.id;
  }

  async function recordClassAttendance(record: ModuleRecord) {
    if (!canManage) return;
    const supabase = createClient();
    if (!supabase) return;
    const candidateIds = classAssignments[record.id] ?? selectedIds(record.data.candidate_ids ?? "");
    if (!candidateIds.length) {
      setError("Assign at least one candidate to this class before recording attendance.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const today = new Date().toISOString().slice(0, 10);
    const { error: attendanceError } = await supabase.from("baptism_class_attendance").upsert(candidateIds.map((candidateId) => ({
      class_id: record.id,
      candidate_id: candidateId,
      attendance_date: today,
      status: "present",
      recorded_by: user?.id ?? null,
    })), { onConflict: "class_id,candidate_id,attendance_date" });
    if (attendanceError) {
      setError(`Unable to record class attendance: ${attendanceError.message}`);
      return;
    }
    setNotice(`Class attendance recorded for ${candidateIds.length} candidate(s).`);
    void loadRecords();
  }

  async function approveTransfer(record: ModuleRecord) {
    if (!canManage) return;
    const config = modules.find((module) => module.key === record.module);
    if (!config || !["transferIn", "transferOut"].includes(config.key)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      approval_status: "approved",
      status: "approved",
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    };
    const { error: approvalError } = await supabase.from(config.table).update(payload).eq("id", record.id);
    if (approvalError) {
      setError(`Unable to approve transfer: ${approvalError.message}`);
      return;
    }
    setNotice("Transfer approved.");
    void loadRecords();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const workingForm = { ...form };
    if (activeModule.key === "candidates" && !workingForm.candidate_id?.trim()) {
      workingForm.candidate_id = nextCandidateId(records.candidates);
      setForm(workingForm);
    }
    const validation = activeModule.fields.filter((field) => field.required).map((field) => required(workingForm[field.key], field.label)).find(Boolean);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      closeForm();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (transferFile && activeModule.key === "transferIn") {
      try {
        const uploaded = await uploadTransferDocument(supabase, transferFile, "incoming");
        workingForm.transfer_letter_url = uploaded.url;
        workingForm.transfer_letter_path = uploaded.path;
      } catch (uploadError) {
        setError(`Unable to upload transfer letter: ${uploadError instanceof Error ? uploadError.message : "Unknown upload error"}`);
        setSaving(false);
        return;
      }
    }
    if (transferFile && activeModule.key === "transferOut") {
      try {
        const uploaded = await uploadTransferDocument(supabase, transferFile, "outgoing");
        workingForm.transfer_request_url = uploaded.url;
        workingForm.transfer_request_path = uploaded.path;
      } catch (uploadError) {
        setError(`Unable to upload transfer request: ${uploadError instanceof Error ? uploadError.message : "Unknown upload error"}`);
        setSaving(false);
        return;
      }
    }
    const payload = payloadFrom(workingForm, user?.id);
    const request = editing
      ? supabase.from(activeModule.table).update(payload).eq("id", editing.id).select().single()
      : supabase.from(activeModule.table).insert({ ...payload, created_by: user?.id ?? null }).select().single();
    const { data, error: saveError } = await request;
    if (saveError) {
      setError(`Unable to save ${activeModule.title}: ${saveError.message}`);
      setSaving(false);
      return;
    }

    const saved = normalizeRow(activeModule.key, data as Record<string, unknown>);
    if (activeModule.key === "classes") {
      try {
        await syncClassCandidates(supabase, saved.id, selectedIds(workingForm.candidate_ids ?? ""), user?.id);
        saved.data.candidate_ids = workingForm.candidate_ids ?? "";
      } catch (syncError) {
        setError(`Class saved, but candidate assignment failed: ${syncError instanceof Error ? syncError.message : "Unknown error"}`);
        setSaving(false);
        return;
      }
    }
    if (activeModule.key === "baptisms") {
      try {
        const memberId = await convertCandidateToMember(supabase, saved, user?.id);
        if (memberId) saved.data.member_id = memberId;
      } catch (conversionError) {
        setError(`Baptism saved, but member conversion failed: ${conversionError instanceof Error ? conversionError.message : "Unknown error"}`);
        setSaving(false);
        return;
      }
    }
    setRecords((current) => ({
      ...current,
      [activeModule.key]: editing
        ? current[activeModule.key].map((record) => record.id === editing.id ? saved : record)
        : [saved, ...current[activeModule.key]],
    }));
    if (activeModule.key === "candidates") {
      setCandidates((current) => editing
        ? current.map((candidate) => candidate.id === saved.id ? { id: saved.id, name: saved.data.full_name, label: `${saved.data.full_name} (${saved.data.candidate_id})` } : candidate)
        : [{ id: saved.id, name: saved.data.full_name, label: `${saved.data.full_name} (${saved.data.candidate_id})` }, ...current]);
    }
    if (activeModule.key === "classes") {
      setClassAssignments((current) => ({ ...current, [saved.id]: selectedIds(workingForm.candidate_ids ?? "") }));
    }
    setNotice(editing ? `${activeModule.title} record updated.` : `${activeModule.title} record created.`);
    setSaving(false);
    closeForm();
    void loadRecords();
  }

  async function remove(record: ModuleRecord) {
    if (!canManage) return;
    const config = modules.find((module) => module.key === record.module) ?? activeModule;
    const name = record.data.full_name || record.data.member_name || record.data.class_name || record.data.candidate_name || "this record";
    if (!window.confirm(`Delete ${name} from ${config.title}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error: deleteError } = await supabase.from(config.table).delete().eq("id", record.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRecords((current) => ({ ...current, [config.key]: current[config.key].filter((item) => item.id !== record.id) }));
    if (config.key === "candidates") setCandidates((current) => current.filter((candidate) => candidate.id !== record.id));
    setNotice(`${config.title} record deleted.`);
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church", 14, 14);
    document.setFontSize(10);
    document.text(`${activeModule.title} Report`, 14, 21);
    autoTableModule.default(document, {
      startY: 28,
      head: [activeModule.columns.map((column) => column.label)],
      body: filtered.map((record) => activeModule.columns.map((column) => displayValue(record.data, column.key))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save(`Hamburg-Ghana-SDA-${activeModule.title.replaceAll(" ", "-")}.pdf`);
  }

  function exportExcel() {
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const headers = activeModule.columns.map((column) => column.label);
    const rows = filtered.map((record) => row(activeModule.columns.map((column) => displayValue(record.data, column.key))));
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escapeXml(activeModule.title)}"><Table>${row(headers)}${rows.join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hamburg-Ghana-SDA-${activeModule.title.replaceAll(" ", "-")}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function displayValue(data: Record<string, string>, key: string) {
    if (key === "status") return labelFor(data[key] ?? "");
    if (key === "approval_status") return labelFor(data[key] ?? "");
    if (key === "candidate_record_id") return candidates.find((candidate) => candidate.id === data[key])?.label ?? "";
    if (key === "candidate_ids") return selectedIds(data[key] ?? "").map((id) => candidates.find((candidate) => candidate.id === id)?.name ?? "Candidate").join(", ");
    if (key === "member_id") return data[key] ? "Member created" : "Pending conversion";
    return data[key] ?? "";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <PageHeading title="Baptism & Membership Transfers" description="Manage baptism candidates, classes, official baptism records, membership transfers, professions of faith, and growth reports." />
        {canManage && <Button type="button" onClick={() => openForm()}><Plus className="h-4 w-4" /> Add {activeModule.title}</Button>}
      </div>
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summary.map(({ label, value, icon: Icon }) => <Card className="flex items-center gap-4 p-5" key={label}><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-navy">{value}</p></div></Card>)}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {modules.map((module) => {
          const Icon = module.icon;
          const active = activeKey === module.key;
          return <button className={`rounded-xl border p-4 text-left transition hover:border-churchblue/40 hover:shadow-card ${active ? "border-churchblue bg-blue-50" : "border-slate-100 bg-white"}`} key={module.key} type="button" onClick={() => { setActiveKey(module.key); setStatus("All Statuses"); }}><Icon className="h-5 w-5 text-churchblue" /><div className="mt-3 flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-navy">{module.title}</h2><StatusBadge tone="blue">{records[module.key].length}</StatusBadge></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{module.description}</p></button>;
        })}
      </section>

      <Card>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center">
          <div><h2 className="font-bold text-navy">{activeModule.title}</h2><p className="mt-1 text-xs text-slate-400">{activeModule.description}</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search baptism and transfer records..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            {activeStatusOptions.length > 0 && <select className={fieldClass.replace("mt-1.5 ", "")} value={status} onChange={(event) => setStatus(event.target.value)}><option>All Statuses</option>{activeStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
            <Button type="button" variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> PDF</Button>
            <Button type="button" variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            {canManage && <Button type="button" onClick={() => openForm()}><Plus className="h-4 w-4" /> Create</Button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{activeModule.columns.map((column) => <th className="px-5 py-3.5 font-semibold" key={column.key}>{column.label}</th>)}<th className="px-5 py-3.5 font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={activeModule.columns.length + 1}>Loading baptism and transfer records...</td></tr>}
              {!loading && filtered.map((record) => <tr className="border-b border-slate-100 last:border-0" key={record.id}>{activeModule.columns.map((column) => <td className="px-5 py-4 text-slate-600" key={column.key}>{["status", "approval_status"].includes(column.key) ? <StatusBadge tone={statusTone(record.data[column.key])}>{labelFor(record.data[column.key])}</StatusBadge> : displayValue(record.data, column.key) || "-"}</td>)}<td className="px-5 py-4"><div className="flex flex-wrap gap-1">{canManage && <Button type="button" size="icon" variant="ghost" aria-label="Edit record" onClick={() => openForm(record)}><Pencil className="h-4 w-4" /></Button>}{canManage && activeKey === "classes" && <Button type="button" size="sm" variant="outline" onClick={() => recordClassAttendance(record)}><CheckCircle2 className="h-4 w-4" /> Attendance</Button>}{canManage && ["transferIn", "transferOut"].includes(activeKey) && record.data.approval_status !== "approved" && <Button type="button" size="sm" variant="outline" onClick={() => approveTransfer(record)}><CheckCircle2 className="h-4 w-4" /> Approve</Button>}{canManage && <Button type="button" size="icon" variant="ghost" aria-label="Delete record" onClick={() => remove(record)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}</div></td></tr>)}
              {!loading && filtered.length === 0 && <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={activeModule.columns.length + 1}>No {activeModule.title.toLowerCase()} records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="grid gap-6 lg:grid-cols-3">
        <ReportCard title="Baptism Reports" rows={[["Candidates studying", records.candidates.filter((record) => record.data.status === "studying").length], ["Ready for baptism", records.candidates.filter((record) => record.data.status === "ready_for_baptism").length], ["Baptism records", records.baptisms.length]]} />
        <ReportCard title="Class Progress" rows={[["Classes", records.classes.length], ["Assigned candidates", Object.values(classAssignments).reduce((sum, ids) => sum + ids.length, 0)], ["Attendance marks", Object.values(classAttendanceCounts).reduce((sum, count) => sum + count, 0)]]} />
        <ReportCard title="Transfer Reports" rows={[["Incoming transfers", records.transferIn.length], ["Outgoing transfers", records.transferOut.length], ["Pending transfers", [...records.transferIn, ...records.transferOut].filter((record) => ["requested", "in_review"].includes(record.data.status)).length]]} />
        <ReportCard title="Membership Growth Reports" rows={[["Baptisms this year", summary[2].value], ["Professions of faith", records.profession.length], ["Completed transfers in", records.transferIn.filter((record) => ["received", "completed"].includes(record.data.status)).length]]} />
      </section>

      {showForm && <RecordModal candidates={candidates} config={activeModule} error={error} form={form} saving={saving} setForm={setForm} setTransferFile={setTransferFile} editing={editing} onClose={closeForm} onSubmit={save} />}
    </div>
  );
}

function ReportCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return <Card><CardHeader><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">Summary for Hamburg Ghana SDA Church records.</p></div></CardHeader><CardContent className="space-y-2">{rows.map(([label, value]) => <div className="flex justify-between rounded-lg border border-slate-100 p-3 text-sm" key={label}><span className="text-slate-600">{label}</span><span className="font-bold text-churchblue">{value}</span></div>)}</CardContent></Card>;
}

function RecordModal({ candidates, config, error, form, setForm, setTransferFile, saving, editing, onClose, onSubmit }: {
  candidates: CandidateOption[];
  config: ModuleConfig;
  error: string;
  form: Record<string, string>;
  setForm: (form: Record<string, string>) => void;
  setTransferFile: (file: File | null) => void;
  saving: boolean;
  editing: ModuleRecord | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  function updateField(key: string, value: string) {
    if (key === "candidate_record_id") {
      const candidate = candidates.find((item) => item.id === value);
      setForm({ ...form, candidate_record_id: value, candidate_name: candidate?.name ?? form.candidate_name ?? "" });
      return;
    }
    setForm({ ...form, [key]: value });
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form noValidate className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5"><div><h2 className="font-bold text-navy">{editing ? "Edit" : "Create"} {config.title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church baptism and transfer record.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={onClose}><X className="h-5 w-5" /></Button></div>{error && <p className="mx-5 mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}<div className="grid gap-4 p-5 sm:grid-cols-2">{config.fields.map((field) => <FieldControl field={field} candidates={candidates} key={field.key} value={form[field.key] ?? ""} onChange={(value) => updateField(field.key, value)} onFileChange={setTransferFile} />)}</div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Record"}</Button></div></form></div>;
}

function FieldControl({ field, value, candidates, onChange, onFileChange }: { field: FieldConfig; value: string; candidates: CandidateOption[]; onChange: (value: string) => void; onFileChange: (file: File | null) => void }) {
  const label = <>{field.label}{field.required ? <span className="text-rose-500"> *</span> : null}</>;
  if (field.type === "textarea") return <label className="text-sm font-semibold text-slate-700 sm:col-span-2">{label}<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  if (field.type === "select") return <label className="text-sm font-semibold text-slate-700">{label}<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  if (field.type === "candidate") return <label className="text-sm font-semibold text-slate-700">{label}<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label>;
  if (field.type === "candidate_multi") {
    const selected = new Set(selectedIds(value));
    return <label className="text-sm font-semibold text-slate-700 sm:col-span-2">{label}<select multiple className="mt-1.5 min-h-40 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-churchblue" value={[...selected]} onChange={(event) => onChange(serializeIds(Array.from(event.currentTarget.selectedOptions).map((option) => option.value)))}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-400">Hold Ctrl or Shift to select multiple candidates.</span></label>;
  }
  if (field.type === "file") return <label className="text-sm font-semibold text-slate-700 sm:col-span-2">{label}<span className="mt-1.5 flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><Upload className="h-4 w-4 text-churchblue" /><input accept="application/pdf,image/jpeg,image/png,image/webp" className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-churchblue" type="file" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} /></span>{value && <a className="mt-1 block text-xs font-bold text-churchblue hover:text-navy" href={value} rel="noreferrer" target="_blank">Current document</a>}<span className="mt-1 block text-xs font-normal text-slate-400">PDF, JPG, PNG, or WEBP. 10 MB max.</span></label>;
  return <label className="text-sm font-semibold text-slate-700">{label}<input className={fieldClass} type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"} min={field.type === "number" ? "0" : undefined} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
