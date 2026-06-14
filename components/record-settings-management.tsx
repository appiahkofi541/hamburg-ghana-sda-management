"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, ToggleLeft, ToggleRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles } from "@/lib/auth";
import { required } from "@/lib/validation";

type SettingGroup = "event_category" | "payment_method" | "ministry_group";
type SettingRow = {
  id: string;
  settingGroup: SettingGroup;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type SettingForm = {
  settingGroup: SettingGroup;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

const groups: { id: SettingGroup; label: string; description: string }[] = [
  { id: "event_category", label: "Event Categories", description: "Calendar and event type dropdowns." },
  { id: "payment_method", label: "Payment Methods", description: "Contribution and expense payment method dropdowns." },
  { id: "ministry_group", label: "Ministry Groups", description: "Optional grouping for departments and ministries." },
];
const emptyForm: SettingForm = { settingGroup: "event_category", name: "", description: "", sortOrder: 100, isActive: true };
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || crypto.randomUUID();
}

function settingLabel(value: SettingGroup) {
  return groups.find((group) => group.id === value)?.label ?? value;
}

export function RecordSettingsManagement() {
  const [activeGroup, setActiveGroup] = useState<SettingGroup>("event_category");
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [form, setForm] = useState<SettingForm | null>(null);
  const [editing, setEditing] = useState<SettingRow | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [canManage, setCanManage] = useState(!createClient());

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
      setCanManage(roles.some((role) => role === "super_admin"));
    }
    const { data, error: loadError } = await supabase.from("record_settings").select("*").order("setting_group").order("sort_order").order("name");
    if (loadError) {
      setError(`Configurable records are not ready yet: ${loadError.message}. Apply migration 202606140001_record_settings_table_fix.sql in Supabase.`);
      setRows([]);
    } else {
      setRows((data ?? []).map((row) => ({
        id: row.id,
        settingGroup: row.setting_group as SettingGroup,
        name: row.name,
        slug: row.slug,
        description: row.description ?? "",
        sortOrder: Number(row.sort_order ?? 0),
        isActive: Boolean(row.is_active),
        createdAt: row.created_at?.slice(0, 10) ?? "",
        updatedAt: row.updated_at?.slice(0, 10) ?? "",
      })));
      setError("");
    }
    setLoading(false);
  }

  const visibleRows = useMemo(() => rows.filter((row) => row.settingGroup === activeGroup), [activeGroup, rows]);

  function openForm(row?: SettingRow) {
    setEditing(row ?? null);
    setError("");
    setForm(row ? {
      settingGroup: row.settingGroup,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    } : { ...emptyForm, settingGroup: activeGroup });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !canManage) return;
    const validationError = required(form.name, "Setting name");
    if (validationError) { setError(validationError); return; }
    const duplicate = rows.find((row) => row.id !== editing?.id && row.settingGroup === form.settingGroup && row.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (duplicate) { setError(`${settingLabel(form.settingGroup)} already contains "${form.name.trim()}".`); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const payload = {
        setting_group: form.settingGroup,
        name: form.name.trim(),
        slug: slugify(form.name),
        description: form.description || null,
        sort_order: Number(form.sortOrder),
        is_active: form.isActive,
        created_by: editing ? undefined : userId || null,
        updated_by: userId || null,
      };
      const request = editing
        ? supabase.from("record_settings").update(payload).eq("id", editing.id).select().single()
        : supabase.from("record_settings").insert(payload).select().single();
      const { error: saveError } = await request;
      if (saveError) {
        setError(saveError.message);
        setSaving(false);
        return;
      }
      await loadSettings();
    }
    setNotice(editing ? "Configurable record updated." : "Configurable record created.");
    setForm(null);
    setEditing(null);
    setSaving(false);
  }

  async function toggleActive(row: SettingRow) {
    if (!canManage) return;
    const supabase = createClient();
    if (supabase) {
      const { error: updateError } = await supabase.from("record_settings").update({ is_active: !row.isActive, updated_by: userId || null }).eq("id", row.id);
      if (updateError) { setError(updateError.message); return; }
      await loadSettings();
    }
    setNotice(`${row.name} ${row.isActive ? "deactivated" : "reactivated"}.`);
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="font-bold text-navy">Configurable Records</h2>
          <p className="mt-1 text-sm text-slate-500">Manage future dropdown values without changing code. Deactivate records instead of deleting them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadSettings}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button disabled={!canManage} size="sm" onClick={() => openForm()}><Plus className="h-4 w-4" /> Add Record</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-churchblue">{notice}</p>}
        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {!canManage && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Read-only access: only Super Admin can manage configurable records.</p>}
        <div className="flex gap-2 overflow-x-auto">
          {groups.map((group) => <Button key={group.id} size="sm" variant={activeGroup === group.id ? "default" : "outline"} onClick={() => setActiveGroup(group.id)}>{group.label}</Button>)}
        </div>
        <p className="text-sm text-slate-500">{groups.find((group) => group.id === activeGroup)?.description}</p>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading configurable records...</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRows.map((row) => (
              <div className="rounded-xl border border-slate-100 p-4" key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-navy">{row.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{row.slug}</p>
                  </div>
                  <StatusBadge tone={row.isActive ? "green" : "slate"}>{row.isActive ? "Active" : "Inactive"}</StatusBadge>
                </div>
                <p className="mt-3 min-h-10 text-sm text-slate-500">{row.description || "No description yet."}</p>
                <div className="mt-3 text-xs text-slate-400">
                  <p>Sort order: {row.sortOrder}</p>
                  <p>Updated: {row.updatedAt || row.createdAt || "Not recorded"}</p>
                </div>
                <div className="mt-4 flex justify-end gap-1 border-t border-slate-100 pt-3">
                  <Button disabled={!canManage} variant="ghost" size="sm" onClick={() => openForm(row)}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Button disabled={!canManage} variant="ghost" size="sm" onClick={() => toggleActive(row)}>{row.isActive ? <ToggleRight className="h-4 w-4 text-emerald-700" /> : <ToggleLeft className="h-4 w-4 text-slate-500" />} {row.isActive ? "Deactivate" : "Reactivate"}</Button>
                </div>
              </div>
            ))}
            {visibleRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">No records found for this group.</p>}
          </div>
        )}
      </CardContent>
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form className="w-full max-w-xl rounded-xl bg-white shadow-2xl" onSubmit={save}>
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="font-bold text-navy">{editing ? "Edit Configurable Record" : "Add Configurable Record"}</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setForm(null)} aria-label="Close configurable record form"><X className="h-5 w-5" /></Button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Group<select className={fieldClass} value={form.settingGroup} onChange={(event) => setForm({ ...form, settingGroup: event.target.value as SettingGroup })}>{groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
              <label className="text-sm font-semibold text-slate-700">Sort Order<input className={fieldClass} type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Name<input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input className="accent-churchblue" type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
              <Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Record"}</Button>
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}
