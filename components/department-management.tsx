"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, ToggleLeft, ToggleRight, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { type DepartmentRecord } from "@/lib/types";
import { normalizeRoles } from "@/lib/auth";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

const storageKey = "hamburg-ghana-sda-departments";
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const seedRecords: DepartmentRecord[] = [];
const emptyRecord: DepartmentRecord = { id: "", name: "", description: "", leader: "", meetingSchedule: "", memberCount: 0, isActive: true, createdAt: "" };
type LeaderOption = { id: string; name: string; email: string };
type MinistryGroupOption = { id: string; name: string; isActive: boolean };

function profileName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return profileName(value[0]);
  const profile = value as { full_name?: unknown; email?: unknown; name?: unknown };
  return String(profile.full_name ?? profile.name ?? profile.email ?? "");
}

export function DepartmentManagement() {
  const [records, setRecords] = useState<DepartmentRecord[]>([]);
  const [leaders, setLeaders] = useState<LeaderOption[]>([]);
  const [ministryGroups, setMinistryGroups] = useState<MinistryGroupOption[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyRecord);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [canManageAll, setCanManageAll] = useState(!createClient());

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          const roles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
          setCanManageAll(roles.some((role) => ["super_admin", "pastor", "church_clerk", "secretary"].includes(role)));
        }
        const [{ data, error: loadError }, { data: profileRows }, { data: membershipRows }, { data: ministryGroupRows }] = await Promise.all([
          supabase.from("departments").select("*, leader:profiles(full_name, email)").order("name"),
          supabase.from("profiles").select("id, full_name, email, user_roles(role)").eq("is_active", true).order("full_name"),
          supabase.from("department_members").select("department_id"),
          supabase.from("record_settings").select("id, name, is_active").eq("setting_group", "ministry_group").order("sort_order").order("name"),
        ]);
        if (loadError) setError(loadError.message);
        setLeaders((profileRows ?? []).map((profile) => ({ id: profile.id, name: profile.full_name ?? profile.email ?? "Unnamed user", email: profile.email ?? "" })));
        const ministryGroupOptions = (ministryGroupRows ?? []).map((group) => ({ id: group.id, name: group.name, isActive: Boolean(group.is_active) }));
        setMinistryGroups(ministryGroupOptions);
        const memberCounts = new Map<string, number>();
        (membershipRows ?? []).forEach((membership) => memberCounts.set(membership.department_id, (memberCounts.get(membership.department_id) ?? 0) + 1));
        if (data?.length) {
          setRecords(data.map((row) => ({ id: row.id, name: row.name, description: row.description ?? "", leader: profileName(row.leader), leaderId: row.leader_id ?? "", ministryGroupId: row.ministry_group_id ?? "", ministryGroupName: ministryGroupOptions.find((group) => group.id === row.ministry_group_id)?.name ?? "", meetingSchedule: row.meeting_schedule ?? "", memberCount: memberCounts.get(row.id) ?? 0, isActive: row.is_active, createdAt: row.created_at?.slice(0, 10) ?? "" })));
          setLoading(false); return;
        }
      }
      const stored = window.localStorage.getItem(storageKey);
      setRecords(stored ? JSON.parse(stored) : seedRecords);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => { if (!createClient() && records.length) window.localStorage.setItem(storageKey, JSON.stringify(records)); }, [records]);
  const filtered = useMemo(() => records.filter((record) => Object.values(record).some((value) => String(value).toLowerCase().includes(query.toLowerCase()))), [query, records]);

  function openForm(record?: DepartmentRecord) { setEditing(record ?? null); setForm(record ? { ...record } : { ...emptyRecord }); setError(""); setShowForm(true); }
  function closeForm() { setEditing(null); setForm(emptyRecord); setShowForm(false); }
  function canEdit(record: DepartmentRecord) { return canManageAll || Boolean(userId && record.leaderId === userId); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(form.name, "Department name");
    if (validationError) { setError(validationError); return; }
    if (!canManageAll) { setError("Only Super Admin, Pastor, Secretary, or Church Clerk can manage departments."); return; }
    const duplicate = records.find((record) => record.id !== editing?.id && record.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (duplicate) { setError("Department already exists."); return; }
    setSaving(true);
    const supabase = createClient();
    let saved = { ...form, id: editing?.id ?? crypto.randomUUID() };
    if (supabase) {
      const payload = { name: form.name.trim(), description: form.description || null, meeting_schedule: form.meetingSchedule || null, leader_id: form.leaderId || null, ministry_group_id: form.ministryGroupId || null, is_active: form.isActive, created_by: editing ? undefined : userId || null, updated_by: userId || null };
      const request = editing ? supabase.from("departments").update(payload).eq("id", editing.id).select().single() : supabase.from("departments").insert(payload).select().single();
      const { data, error: saveError } = await request;
      if (saveError) {
        setError(saveError.code === "23505" ? "Department already exists." : saveError.message);
        setSaving(false);
        return;
      }
      saved = { ...saved, id: data.id, name: data.name, leader: leaders.find((leader) => leader.id === form.leaderId)?.name ?? "", ministryGroupName: ministryGroups.find((group) => group.id === form.ministryGroupId)?.name ?? "", memberCount: editing?.memberCount ?? 0 };
    }
    setRecords((current) => editing ? current.map((item) => item.id === editing.id ? saved : item) : [...current, saved]);
    setNotice(editing ? "Department updated." : "Department added.");
    setSaving(false); closeForm();
  }

  async function toggleActive(record: DepartmentRecord) {
    if (!canManageAll) { setError("Only Super Admin, Pastor, Secretary, or Church Clerk can activate or deactivate departments."); return; }
    const supabase = createClient();
    if (supabase) {
      const { error: updateError } = await supabase.from("departments").update({ is_active: !record.isActive, updated_by: userId || null }).eq("id", record.id);
      if (updateError) { setError(updateError.message); return; }
    }
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, isActive: !item.isActive } : item));
    setNotice(`${record.name} ${record.isActive ? "deactivated" : "activated"}.`);
  }

  return <div className="space-y-6">
    <PageHeading title="Departments" description="Coordinate SDA ministries, leaders, and service teams." />
    {notice && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-churchblue">{notice}</p>}
    {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <Card>
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row"><label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search departments..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>{canManageAll && <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Add Department</Button>}</div>
      {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading departments...</p> : <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((record) => <div className="rounded-xl border border-slate-100 p-4" key={record.id}><div className="flex justify-between"><div className="rounded-lg bg-blue-50 p-2.5 text-churchblue"><Users className="h-5 w-5" /></div><StatusBadge tone={record.isActive ? "green" : "slate"}>{record.isActive ? "Active" : "Inactive"}</StatusBadge></div><h2 className="mt-4 font-bold text-navy">{record.name}</h2><p className="mt-2 min-h-10 text-sm text-slate-500">{record.description}</p><div className="mt-3 space-y-1 text-xs text-slate-400"><p>Ministry group: {record.ministryGroupName || "Not assigned"}</p><p>Leader: {record.leader || "Not assigned"}</p><p>Meeting: {record.meetingSchedule || "Not scheduled"}</p><p>Members: {record.memberCount}</p><p>Created: {record.createdAt || "Not recorded"}</p></div>{canEdit(record) && <div className="mt-4 flex justify-end gap-1 border-t border-slate-100 pt-3"><Button variant="ghost" size="icon" aria-label={`Edit ${record.name}`} onClick={() => openForm(record)}><Pencil className="h-4 w-4" /></Button>{canManageAll && <Button variant="ghost" size="icon" aria-label={`${record.isActive ? "Deactivate" : "Activate"} ${record.name}`} onClick={() => toggleActive(record)}>{record.isActive ? <ToggleRight className="h-4 w-4 text-emerald-700" /> : <ToggleLeft className="h-4 w-4 text-slate-500" />}</Button>}</div>}</div>)}</div>}
    </Card>
    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="w-full max-w-xl rounded-xl bg-white shadow-2xl" onSubmit={save}><div className="flex justify-between border-b border-slate-100 p-5"><h2 className="font-bold text-navy">{editing ? "Edit Department" : "Add Department"}</h2><Button type="button" variant="ghost" size="icon" aria-label="Close department form" onClick={closeForm}><X className="h-5 w-5" /></Button></div>{error && <div className="mx-5 mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}<div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Department Name<input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter department name" /></label><label className="text-sm font-semibold text-slate-700">Meeting Schedule<input className={fieldClass} value={form.meetingSchedule} onChange={(event) => setForm({ ...form, meetingSchedule: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Ministry Group<select className={fieldClass} value={form.ministryGroupId ?? ""} onChange={(event) => setForm({ ...form, ministryGroupId: event.target.value })}><option value="">No ministry group assigned</option>{ministryGroups.filter((group) => group.isActive || group.id === form.ministryGroupId).map((group) => <option disabled={!group.isActive && group.id !== form.ministryGroupId} key={group.id} value={group.id}>{group.name}{group.isActive ? "" : " (Inactive)"}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Department Head<select className={fieldClass} value={form.leaderId ?? ""} onChange={(event) => setForm({ ...form, leaderId: event.target.value })}><option value="">No department head assigned</option>{leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.name}{leader.email ? ` (${leader.email})` : ""}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active department</label></div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Department"}</Button></div></form></div>}
  </div>;
}
