"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, MailPlus, Search, ShieldCheck, UserRoundX, X } from "lucide-react";
import { APP_ROLES, ROLE_LABELS, getPrimaryRole, normalizeRoles, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { useT } from "@/components/language-provider";

type UserRecord = { id: string; name: string; email: string; roles: AppRole[]; active: boolean; createdAt: string };
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";

export function UserAccessManagement() {
  const t = useT();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [query, setQuery] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [invitationsConfigured, setInvitationsConfigured] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [invite, setInvite] = useState({ fullName: "", email: "", role: "member" as AppRole });
  const [role, setRole] = useState<AppRole>("member");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/users", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to load users.");
    else {
      setUsers(result.users.map((user: { id: string; full_name: string; email: string; is_active: boolean; created_at: string; user_roles: { role: string }[] }) => ({ id: user.id, name: user.full_name, email: user.email, active: user.is_active, createdAt: user.created_at.slice(0, 10), roles: normalizeRoles(user.user_roles.map(({ role }) => role)) })));
      setInvitationsConfigured(result.capabilities?.invitationsConfigured ?? false);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => !normalized || `${user.name} ${user.email} ${ROLE_LABELS[getPrimaryRole(user.roles)]}`.toLowerCase().includes(normalized));
  }, [query, users]);

  async function request(body: Record<string, unknown>, method: "POST" | "PATCH", url = "/api/users") {
    setSaving(true); setError(""); setNotice("");
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to update user access.");
    else { setNotice(result.message); await load(); }
    setSaving(false);
    return response.ok;
  }

  async function inviteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await request(invite, "POST", "/api/users/invite")) { setInvite({ fullName: "", email: "", role: "member" }); setShowInvite(false); }
  }
  async function saveRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing && await request({ action: "role", userId: editing.id, role }, "PATCH")) setEditing(null);
  }
  async function deactivate(user: UserRecord) {
    if (!window.confirm(`Deactivate ${user.name}? They will no longer be able to access the church management system.`)) return;
    await request({ action: "deactivate", userId: user.id }, "PATCH");
  }
  async function resetPassword(user: UserRecord) {
    await request({ action: "reset_password", userId: user.id, email: user.email }, "PATCH");
  }

  return <div className="space-y-6">
    <PageHeading title={t("users.title")} description={t("users.description")} />
    {notice && <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
    {error && <div className="flex items-center justify-between rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}
    {!invitationsConfigured && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">Role editing, deactivation, and password reset links are active. New user invitations are disabled until the server-side Supabase admin credential is configured in the deployment environment.</p>}
    <section className="grid gap-4 sm:grid-cols-3"><Card className="p-5"><p className="text-sm text-slate-500">Total Users</p><p className="mt-2 text-2xl font-bold text-navy">{users.length}</p></Card><Card className="p-5"><p className="text-sm text-slate-500">Active Users</p><p className="mt-2 text-2xl font-bold text-emerald-700">{users.filter(({ active }) => active).length}</p></Card><Card className="p-5"><p className="text-sm text-slate-500">Available Roles</p><p className="mt-2 text-2xl font-bold text-churchblue">{APP_ROLES.length}</p></Card></section>
    <Card><div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder={t("users.searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label><Button disabled={!invitationsConfigured} title={invitationsConfigured ? "Invite a new user" : "New invitations require server-side Supabase admin credentials"} onClick={() => setShowInvite(true)}><MailPlus className="h-4 w-4" /> {t("button.inviteUser")}</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{["User", "Role", "Status", "Created", "Actions"].map((label) => <th className="px-5 py-3.5 font-semibold" key={label}>{label}</th>)}</tr></thead><tbody>{loading && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={5}>Loading users...</td></tr>}{!loading && filtered.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={5}>No users found.</td></tr>}{filtered.map((user) => <tr className="border-t border-slate-100" key={user.id}><td className="px-5 py-4"><p className="font-bold text-navy">{user.name}</p><p className="mt-1 text-xs text-slate-400">{user.email}</p></td><td className="px-5 py-4"><StatusBadge tone="blue">{ROLE_LABELS[getPrimaryRole(user.roles)]}</StatusBadge></td><td className="px-5 py-4"><StatusBadge tone={user.active ? "green" : "red"}>{user.active ? "Active" : "Inactive"}</StatusBadge></td><td className="px-5 py-4 text-slate-500">{user.createdAt}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(user); setRole(getPrimaryRole(user.roles)); }}><ShieldCheck className="h-4 w-4" /> Edit Role</Button><Button size="sm" variant="outline" onClick={() => resetPassword(user)}><KeyRound className="h-4 w-4" /> Reset Password</Button>{user.active && <Button size="sm" variant="ghost" onClick={() => deactivate(user)}><UserRoundX className="h-4 w-4 text-rose-600" /> Deactivate</Button>}</div></td></tr>)}</tbody></table></div></Card>
    <Card className="p-5"><h2 className="font-bold text-navy">Available Roles</h2><p className="mt-2 text-sm leading-6 text-slate-500">{APP_ROLES.map((item) => ROLE_LABELS[item]).join(", ")}.</p></Card>
    {showInvite && <Modal title={t("button.inviteUser")} saving={saving} onClose={() => setShowInvite(false)} onSubmit={inviteUser}><label className="text-sm font-semibold text-slate-700">Full name<input className={fieldClass} required value={invite.fullName} onChange={(event) => setInvite({ ...invite, fullName: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Email<input className={fieldClass} required type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></label><RoleSelect role={invite.role} onChange={(value) => setInvite({ ...invite, role: value })} /></Modal>}
    {editing && <Modal title={`Edit Role: ${editing.name}`} saving={saving} onClose={() => setEditing(null)} onSubmit={saveRole}><RoleSelect role={role} onChange={setRole} /><p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">Changing a role updates navigation and Supabase row-level permissions immediately.</p></Modal>}
  </div>;
}

function RoleSelect({ role, onChange }: { role: AppRole; onChange: (role: AppRole) => void }) {
  return <label className="text-sm font-semibold text-slate-700">Role<select className={fieldClass} value={role} onChange={(event) => onChange(event.target.value as AppRole)}>{APP_ROLES.map((item) => <option value={item} key={item}>{ROLE_LABELS[item]}</option>)}</select></label>;
}

function Modal({ title, saving, onClose, onSubmit, children }: { title: string; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  const t = useT();
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="w-full max-w-lg rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-bold text-navy">{title}</h2><Button type="button" variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="space-y-4 p-5">{children}</div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>{t("button.cancel")}</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : t("button.save")}</Button></div></form></div>;
}
