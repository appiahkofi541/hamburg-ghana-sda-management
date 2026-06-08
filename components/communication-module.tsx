"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellRing, CheckCircle2, Clock, Megaphone, Plus, Search, Send, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles, type AppRole } from "@/lib/auth";

type Channel = "email" | "whatsapp" | "sms" | "push";
type Audience = "all_members" | "department" | "leaders" | "individual";
type CampaignStatus = "draft" | "scheduled" | "pending" | "sent" | "failed";
type Tab = "announcements" | "notifications" | "history" | "templates" | "preferences";

type Member = { id: string; name: string; memberId: string; email: string; phone: string; department: string };
type Announcement = { id: string; title: string; body: string; audience: Audience; department: string; status: string; scheduledAt: string; expiresAt: string };
type Campaign = { id: string; title: string; channel: Channel; audience: Audience; recipientId: string; department: string; subject: string; message: string; scheduledAt: string; status: CampaignStatus };
type Delivery = { id: string; title: string; channel: Channel; recipient: string; status: CampaignStatus; sentAt: string; error: string };
type Template = { id: string; name: string; channel: Channel; subject: string; body: string };
type Preference = { id: string; memberId: string; memberName: string; email: boolean; sms: boolean; whatsapp: boolean; push: boolean };

const tabs: { id: Tab; label: string }[] = [
  { id: "announcements", label: "Announcements Center" },
  { id: "notifications", label: "Send Notifications" },
  { id: "history", label: "Notification History" },
  { id: "templates", label: "Email Templates" },
  { id: "preferences", label: "Member Preferences" },
];

const communicationManagers: AppRole[] = ["super_admin", "pastor", "elder", "secretary"];
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";
const textareaClass = "mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-churchblue";
const storageKey = "hamburg-ghana-sda-communications";

const emptyAnnouncement = { title: "", body: "", audience: "all_members" as Audience, department: "", scheduledAt: "", expiresAt: "" };
const emptyCampaign = { title: "", channel: "email" as Channel, audience: "all_members" as Audience, recipientId: "", department: "", subject: "", message: "", scheduledAt: "" };
const emptyTemplate = { name: "", channel: "email" as Channel, subject: "", body: "" };

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asText(value: unknown) {
  return String(value ?? "");
}

function channelTone(channel: Channel) {
  if (channel === "email") return "blue";
  if (channel === "whatsapp") return "green";
  if (channel === "sms") return "gold";
  return "slate";
}

function fromAnnouncementRow(row: Record<string, unknown>): Announcement {
  return {
    id: asText(row.id),
    title: asText(row.title),
    body: asText(row.body),
    audience: asText(row.target_audience) as Audience,
    department: asText(row.department_name),
    status: label(asText(row.status)),
    scheduledAt: asText(row.scheduled_at).slice(0, 16),
    expiresAt: asText(row.expires_at).slice(0, 10),
  };
}

export function CommunicationModule() {
  const [activeTab, setActiveTab] = useState<Tab>("announcements");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncement);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);

  const canManageAll = roles.some((role) => communicationManagers.includes(role));
  const canManageAnnouncements = canManageAll;
  const filteredDeliveries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return deliveries.filter((delivery) => !needle || [delivery.title, delivery.recipient, delivery.channel, delivery.status].some((value) => value.toLowerCase().includes(needle)));
  }, [deliveries, query]);
  const stats = useMemo(() => ({
    sent: deliveries.filter((item) => item.status === "sent").length,
    pending: deliveries.filter((item) => item.status === "pending" || item.status === "scheduled").length,
    failed: deliveries.filter((item) => item.status === "failed").length,
  }), [deliveries]);

  async function load() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    if (!supabase) {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setAnnouncements(parsed.announcements ?? []);
        setCampaigns(parsed.campaigns ?? []);
        setDeliveries(parsed.deliveries ?? []);
        setTemplates(parsed.templates ?? []);
      }
      setRoles(["super_admin"]);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setRoles(normalizeRoles((roleRows ?? []).map(({ role }) => role)));

    const [memberResult, announcementResult, campaignResult, deliveryResult, templateResult, preferenceResult] = await Promise.all([
      supabase.from("members").select("id, member_id, full_name, first_name, last_name, email, phone, department:departments(name)").order("full_name"),
      supabase.from("communication_announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("communication_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("communication_delivery_logs").select("*").order("created_at", { ascending: false }),
      supabase.from("communication_templates").select("*").order("name"),
      supabase.from("member_notification_preferences").select("*, members(full_name, first_name, last_name)").order("created_at", { ascending: false }),
    ]);

    if (announcementResult.error || campaignResult.error || deliveryResult.error || templateResult.error || preferenceResult.error) {
      setError(`${announcementResult.error?.message ?? campaignResult.error?.message ?? deliveryResult.error?.message ?? templateResult.error?.message ?? preferenceResult.error?.message}. Apply migration 202606080002_communication_module.sql in Supabase.`);
    }

    setMembers((memberResult.data ?? []).map((row) => {
      const member = row as Record<string, unknown>;
      const department = member.department as { name?: string } | null;
      const fallbackName = `${asText(member.first_name)} ${asText(member.last_name)}`.trim();
      return {
        id: asText(member.id),
        memberId: asText(member.member_id),
        name: asText(member.full_name) || fallbackName,
        email: asText(member.email),
        phone: asText(member.phone),
        department: department?.name ?? "",
      };
    }));
    setAnnouncements((announcementResult.data ?? []).map((row) => fromAnnouncementRow(row as Record<string, unknown>)));
    setCampaigns((campaignResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      channel: row.channel,
      audience: row.target_audience,
      recipientId: row.recipient_member_id ?? "",
      department: row.department_name ?? "",
      subject: row.subject ?? "",
      message: row.message,
      scheduledAt: row.scheduled_at?.slice(0, 16) ?? "",
      status: row.status,
    })));
    setDeliveries((deliveryResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.notification_title,
      channel: row.channel,
      recipient: row.recipient_name ?? row.recipient_contact ?? "Recipient",
      status: row.status,
      sentAt: row.sent_at?.slice(0, 16) ?? row.created_at?.slice(0, 16) ?? "",
      error: row.error_message ?? "",
    })));
    setTemplates((templateResult.data ?? []).map((row) => ({ id: row.id, name: row.name, channel: row.channel, subject: row.subject ?? "", body: row.body })));
    setPreferences((preferenceResult.data ?? []).map((row) => {
      const member = Array.isArray(row.members) ? row.members[0] : row.members;
      return {
        id: row.id,
        memberId: row.member_id,
        memberName: member?.full_name || `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim() || "Member",
        email: Boolean(row.email_enabled),
        sms: Boolean(row.sms_enabled),
        whatsapp: Boolean(row.whatsapp_enabled),
        push: Boolean(row.push_enabled),
      };
    }));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function saveLocal(next: Partial<{ announcements: Announcement[]; campaigns: Campaign[]; deliveries: Delivery[]; templates: Template[] }>) {
    const payload = { announcements, campaigns, deliveries, templates, ...next };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  async function saveAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAnnouncements) return setError("Access denied. Only Super Admin, Pastor, Elder, or Secretary can manage announcements.");
    setSaving(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    if (supabase) {
      try {
        const response = await fetch("/api/communications/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: announcementForm.title,
            body: announcementForm.body,
            targetAudience: announcementForm.audience,
            departmentName: announcementForm.department,
            scheduledAt: announcementForm.scheduledAt,
            expiresAt: announcementForm.expiresAt,
          }),
        });
        const text = await response.text();
        const result = text ? JSON.parse(text) : {};
        if (!response.ok) {
          setError(result.error ?? `Announcement was not saved. Server returned ${response.status}.`);
          setSaving(false);
          return;
        }
        setNotice(result.message ?? "Announcement saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Announcement was not saved because the request failed.");
        setSaving(false);
        return;
      }
    } else {
      const next = [{ ...announcementForm, id: crypto.randomUUID(), status: announcementForm.scheduledAt ? "Scheduled" : "Published" }, ...announcements];
      setAnnouncements(next);
      saveLocal({ announcements: next });
      setNotice("Announcement saved locally.");
    }
    setAnnouncementForm(emptyAnnouncement);
    setShowAnnouncement(false);
    setSaving(false);
    await load();
  }

  async function saveCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAll) return setError("Access denied. Only Super Admin, Pastor, Elder, or Secretary can send notifications.");
    setSaving(true);
    setError("");
    const supabase = createClient();
    if (supabase) {
      const { data, error: saveError } = await supabase.from("communication_campaigns").insert({
        title: campaignForm.title,
        channel: campaignForm.channel,
        target_audience: campaignForm.audience,
        recipient_member_id: campaignForm.recipientId || null,
        department_name: campaignForm.department || null,
        subject: campaignForm.subject || null,
        message: campaignForm.message,
        scheduled_at: campaignForm.scheduledAt || null,
        status: campaignForm.scheduledAt ? "scheduled" : "draft",
      }).select("id").single();
      if (saveError) setError(saveError.message);
      else {
        setNotice("Notification campaign saved.");
        if (data && !campaignForm.scheduledAt) await sendCampaign(data.id);
      }
    } else {
      const next = [{ ...campaignForm, id: crypto.randomUUID(), status: campaignForm.scheduledAt ? "scheduled" as CampaignStatus : "draft" as CampaignStatus }, ...campaigns];
      setCampaigns(next);
      saveLocal({ campaigns: next });
      setNotice("Notification campaign saved locally.");
    }
    setCampaignForm(emptyCampaign);
    setShowCampaign(false);
    setSaving(false);
    await load();
  }

  async function saveTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAll) return setError("Access denied. Only Super Admin, Pastor, Elder, or Secretary can save templates.");
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { error: saveError } = await supabase.from("communication_templates").insert(templateForm);
      if (saveError) setError(saveError.message);
      else setNotice("Template saved.");
    } else {
      const next = [{ ...templateForm, id: crypto.randomUUID() }, ...templates];
      setTemplates(next);
      saveLocal({ templates: next });
      setNotice("Template saved locally.");
    }
    setTemplateForm(emptyTemplate);
    setShowTemplate(false);
    setSaving(false);
    await load();
  }

  async function sendCampaign(campaignId: string) {
    const response = await fetch("/api/communications/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to send notification.");
    else setNotice(result.message ?? "Notification queued.");
  }

  async function updatePreference(preference: Preference, channel: Channel, enabled: boolean) {
    const supabase = createClient();
    if (!supabase) return;
    const column = `${channel}_enabled`;
    const { error: saveError } = await supabase.from("member_notification_preferences").update({ [column]: enabled }).eq("id", preference.id);
    if (saveError) setError(saveError.message);
    else {
      setPreferences((current) => current.map((item) => item.id === preference.id ? { ...item, [channel]: enabled } : item));
      setNotice("Notification preference updated.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <PageHeading title="Communication Module" description="Manage announcements, Email, WhatsApp, SMS, notification delivery history, and member communication preferences." />
        <div className="flex flex-wrap gap-2">
          {canManageAnnouncements && <Button variant="outline" onClick={() => setShowAnnouncement(true)}><Megaphone className="h-4 w-4" /> New Announcement</Button>}
          {canManageAll && <Button onClick={() => setShowCampaign(true)}><Send className="h-4 w-4" /> Send Notification</Button>}
        </div>
      </div>
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {!canManageAll && !canManageAnnouncements && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Members receive notifications only. Communication management actions are hidden for your role.</p>}

      <section className="grid gap-4 md:grid-cols-3">
        <Metric icon={CheckCircle2} label="Total Messages Sent" value={stats.sent} tone="bg-green-50 text-green-700" />
        <Metric icon={Clock} label="Pending Notifications" value={stats.pending} tone="bg-amber-50 text-amber-700" />
        <Metric icon={BellRing} label="Failed Notifications" value={stats.failed} tone="bg-rose-50 text-rose-700" />
      </section>

      <Card className="overflow-hidden">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
          {tabs.map((tab) => <button className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-churchblue text-white" : "text-slate-600 hover:bg-slate-100"}`} key={tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </div>
        {activeTab === "announcements" && <AnnouncementsTab announcements={announcements} loading={loading} onAdd={() => setShowAnnouncement(true)} canManage={canManageAnnouncements} />}
        {activeTab === "notifications" && <NotificationsTab campaigns={campaigns} canManage={canManageAll} onAdd={() => setShowCampaign(true)} onSend={sendCampaign} />}
        {activeTab === "history" && <HistoryTab deliveries={filteredDeliveries} query={query} setQuery={setQuery} />}
        {activeTab === "templates" && <TemplatesTab templates={templates} canManage={canManageAll} onAdd={() => setShowTemplate(true)} />}
        {activeTab === "preferences" && <PreferencesTab preferences={preferences} updatePreference={updatePreference} />}
      </Card>

      {showAnnouncement && <AnnouncementModal error={error} form={announcementForm} setForm={setAnnouncementForm} saving={saving} onClose={() => setShowAnnouncement(false)} onSubmit={saveAnnouncement} />}
      {showCampaign && <CampaignModal form={campaignForm} setForm={setCampaignForm} saving={saving} members={members} templates={templates} onClose={() => setShowCampaign(false)} onSubmit={saveCampaign} />}
      {showTemplate && <TemplateModal form={templateForm} setForm={setTemplateForm} saving={saving} onClose={() => setShowTemplate(false)} onSubmit={saveTemplate} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof BellRing; label: string; value: number; tone: string }) {
  return <Card className="flex items-center gap-4 p-5"><div className={`rounded-lg p-3 ${tone}`}><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-navy">{value}</p></div></Card>;
}

function AnnouncementsTab({ announcements, loading, canManage, onAdd }: { announcements: Announcement[]; loading: boolean; canManage: boolean; onAdd: () => void }) {
  return <div className="p-4"><SectionHeader title="Scheduled and Published Announcements" action={canManage ? <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> Create</Button> : null} />{loading ? <Empty text="Loading announcements..." /> : <div className="grid gap-4 lg:grid-cols-2">{announcements.map((item) => <article className="rounded-xl border border-slate-100 p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-navy">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{label(item.audience)}{item.department ? ` · ${item.department}` : ""}</p></div><StatusBadge tone={item.status === "Published" ? "green" : "gold"}>{item.status}</StatusBadge></div><p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p><p className="mt-3 text-xs text-slate-400">Scheduled: {item.scheduledAt || "Now"} · Expires: {item.expiresAt || "No expiry"}</p></article>)}{announcements.length === 0 && <Empty text="No communication announcements found." />}</div>}</div>;
}

function NotificationsTab({ campaigns, canManage, onAdd, onSend }: { campaigns: Campaign[]; canManage: boolean; onAdd: () => void; onSend: (id: string) => void }) {
  return <div className="p-4"><SectionHeader title="Email, WhatsApp, SMS, and Emergency Alerts" action={canManage ? <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> New Message</Button> : null} /><div className="grid gap-4 lg:grid-cols-2">{campaigns.map((campaign) => <article className="rounded-xl border border-slate-100 p-4" key={campaign.id}><div className="flex items-start justify-between gap-3"><div><StatusBadge tone={channelTone(campaign.channel)}>{label(campaign.channel)}</StatusBadge><h3 className="mt-3 font-bold text-navy">{campaign.title}</h3></div><StatusBadge tone={campaign.status === "sent" ? "green" : campaign.status === "failed" ? "red" : "gold"}>{label(campaign.status)}</StatusBadge></div><p className="mt-3 text-sm leading-6 text-slate-600">{campaign.message}</p><p className="mt-3 text-xs text-slate-400">Audience: {label(campaign.audience)} · Scheduled: {campaign.scheduledAt || "Immediate"}</p>{canManage && <Button className="mt-4" size="sm" variant="outline" onClick={() => onSend(campaign.id)}><Send className="h-4 w-4" /> Send / Retry</Button>}</article>)}{campaigns.length === 0 && <Empty text="No notification campaigns found." />}</div></div>;
}

function HistoryTab({ deliveries, query, setQuery }: { deliveries: Delivery[]; query: string; setQuery: (value: string) => void }) {
  return <div className="p-4"><div className="mb-4 flex h-10 max-w-md items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search delivery logs..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{["Sent Date", "Recipient", "Channel", "Status", "Delivery Logs"].map((heading) => <th className="px-4 py-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead><tbody>{deliveries.map((item) => <tr className="border-b border-slate-100 last:border-0" key={item.id}><td className="px-4 py-4 text-slate-600">{item.sentAt}</td><td className="px-4 py-4 font-semibold text-navy">{item.recipient}</td><td className="px-4 py-4"><StatusBadge tone={channelTone(item.channel)}>{label(item.channel)}</StatusBadge></td><td className="px-4 py-4"><StatusBadge tone={item.status === "sent" ? "green" : item.status === "failed" ? "red" : "gold"}>{label(item.status)}</StatusBadge></td><td className="px-4 py-4 text-slate-500">{item.error || item.title}</td></tr>)}{deliveries.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={5}>No delivery logs found.</td></tr>}</tbody></table></div></div>;
}

function TemplatesTab({ templates, canManage, onAdd }: { templates: Template[]; canManage: boolean; onAdd: () => void }) {
  return <div className="p-4"><SectionHeader title="Reusable Email and Message Templates" action={canManage ? <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> Add Template</Button> : null} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <article className="rounded-xl border border-slate-100 p-4" key={template.id}><StatusBadge tone={channelTone(template.channel)}>{label(template.channel)}</StatusBadge><h3 className="mt-3 font-bold text-navy">{template.name}</h3>{template.subject && <p className="mt-1 text-xs font-semibold text-slate-400">{template.subject}</p>}<p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{template.body}</p></article>)}{templates.length === 0 && <Empty text="No templates found." />}</div></div>;
}

function PreferencesTab({ preferences, updatePreference }: { preferences: Preference[]; updatePreference: (preference: Preference, channel: Channel, enabled: boolean) => void }) {
  return <div className="p-4"><SectionHeader title="Member Notification Preferences" action={null} /><div className="space-y-3">{preferences.map((preference) => <div className="grid gap-3 rounded-xl border border-slate-100 p-4 md:grid-cols-[minmax(0,1fr)_repeat(4,auto)] md:items-center" key={preference.id}><div><p className="font-bold text-navy">{preference.memberName}</p><p className="text-xs text-slate-400">Controls Email, SMS, WhatsApp, and Push Notifications.</p></div>{(["email", "sms", "whatsapp", "push"] as Channel[]).map((channel) => <label className="flex items-center gap-2 text-sm font-semibold text-slate-600" key={channel}><input className="accent-churchblue" type="checkbox" checked={Boolean(preference[channel])} onChange={(event) => updatePreference(preference, channel, event.target.checked)} /> {label(channel)}</label>)}</div>)}{preferences.length === 0 && <Empty text="No member preferences found. They will appear as members are added or after the migration seed runs." />}</div></div>;
}

function SectionHeader({ title, action }: { title: string; action: React.ReactNode }) {
  return <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><h2 className="font-bold text-navy">{title}</h2>{action}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">{text}</div>;
}

function AnnouncementModal({ error, form, setForm, saving, onClose, onSubmit }: { error: string; form: typeof emptyAnnouncement; setForm: (form: typeof emptyAnnouncement) => void; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Create Announcement" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2">{error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}<Input label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required /><Select label="Target Audience" value={form.audience} onChange={(value) => setForm({ ...form, audience: value as Audience })} options={["all_members", "department", "leaders"]} /><Input label="Department" value={form.department} onChange={(value) => setForm({ ...form, department: value })} /><Input label="Schedule Date" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm({ ...form, scheduledAt: value })} /><Input label="Expiry Date" type="date" value={form.expiresAt} onChange={(value) => setForm({ ...form, expiresAt: value })} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Body<textarea className={textareaClass} required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label></div><ModalActions saving={saving} label="Save Announcement" onClose={onClose} /></form></Modal>;
}

function CampaignModal({ form, setForm, saving, members, templates, onClose, onSubmit }: { form: typeof emptyCampaign; setForm: (form: typeof emptyCampaign) => void; saving: boolean; members: Member[]; templates: Template[]; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Send Notification" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><Input label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required /><Select label="Channel" value={form.channel} onChange={(value) => setForm({ ...form, channel: value as Channel })} options={["email", "whatsapp", "sms", "push"]} /><Select label="Target Audience" value={form.audience} onChange={(value) => setForm({ ...form, audience: value as Audience })} options={["all_members", "department", "leaders", "individual"]} /><label className="text-sm font-semibold text-slate-700">Individual Member<select className={fieldClass} value={form.recipientId} onChange={(event) => setForm({ ...form, recipientId: event.target.value })}><option value="">Select member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.memberId})</option>)}</select></label><Input label="Department" value={form.department} onChange={(value) => setForm({ ...form, department: value })} /><Input label="Schedule Date" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm({ ...form, scheduledAt: value })} /><Input label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} /><label className="text-sm font-semibold text-slate-700">Use Template<select className={fieldClass} onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); if (template) setForm({ ...form, channel: template.channel, subject: template.subject, message: template.body }); }}><option value="">Choose template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Message<textarea className={textareaClass} required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label><p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 sm:col-span-2">Email, SMS, and WhatsApp providers are checked server-side. If credentials are not configured yet, the app records delivery logs as failed with a clear provider message.</p></div><ModalActions saving={saving} label="Save / Send" onClose={onClose} /></form></Modal>;
}

function TemplateModal({ form, setForm, saving, onClose, onSubmit }: { form: typeof emptyTemplate; setForm: (form: typeof emptyTemplate) => void; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Create Template" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><Input label="Template Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><Select label="Channel" value={form.channel} onChange={(value) => setForm({ ...form, channel: value as Channel })} options={["email", "whatsapp", "sms", "push"]} /><Input label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Body<textarea className={textareaClass} required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label></div><ModalActions saving={saving} label="Save Template" onClose={onClose} /></form></Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5"><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church communication center</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close communication form" onClick={onClose}><X className="h-5 w-5" /></Button></div>{children}</div></div>;
}

function ModalActions({ saving, label: actionLabel, onClose }: { saving: boolean; label: string; onClose: () => void }) {
  return <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : actionLabel}</Button></div>;
}

function Input({ label: inputLabel, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-sm font-semibold text-slate-700">{inputLabel}<input className={fieldClass} required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label: selectLabel, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="text-sm font-semibold text-slate-700">{selectLabel}<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</select></label>;
}
