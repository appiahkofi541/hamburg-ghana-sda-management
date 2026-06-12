"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  BellRing, CalendarClock, Cake, Download, FileSpreadsheet, Mail, MessageCircle,
  Plus, Search, Send, Smartphone, UsersRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles, type AppRole } from "@/lib/auth";

type Channel = "email" | "whatsapp" | "sms";
type Audience = "all_members" | "all_visitors" | "department" | "role" | "individual";
type CampaignStatus = "draft" | "scheduled" | "pending" | "sent" | "failed";
type ReminderType = "general" | "event_reminder" | "baptism_class_reminder" | "visitor_follow_up" | "birthday_greeting" | "sabbath_service" | "prayer_meeting" | "prayer_request" | "contribution_receipt";
type Tab = "compose" | "reminders" | "templates" | "history";

type DepartmentOption = { id: string; name: string; isActive: boolean };
type RecipientOption = { id: string; name: string; email: string; phone: string; kind: "member" | "visitor" };
type Template = { id: string; name: string; channel: Channel; subject: string; body: string };
type Campaign = {
  id: string;
  title: string;
  channel: Channel;
  audience: Audience;
  department: string;
  roleName: string;
  recipientMemberId: string;
  recipientVisitorId: string;
  reminderType: ReminderType;
  subject: string;
  message: string;
  scheduledAt: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
};
type Delivery = { id: string; title: string; channel: Channel; recipient: string; contact: string; status: CampaignStatus; deliveryStatus: string; sentAt: string; error: string };
type EventOption = { id: string; title: string; startsAt: string };
type VisitorFollowUp = { id: string; fullName: string; nextFollowUpDate: string };
type BaptismClass = { id: string; className: string; startDate: string; instructor: string };

const managerRoles: AppRole[] = ["super_admin", "pastor", "secretary", "treasurer"];
const roleOptions = ["pastor", "elder", "secretary", "treasurer", "member"];
const channelOptions: Channel[] = ["email", "whatsapp", "sms"];
const reminderOptions: ReminderType[] = ["general", "event_reminder", "baptism_class_reminder", "visitor_follow_up", "birthday_greeting", "sabbath_service", "prayer_meeting", "prayer_request", "contribution_receipt"];
const tabs: { id: Tab; label: string }[] = [
  { id: "compose", label: "Bulk Messaging" },
  { id: "reminders", label: "Automatic Reminders" },
  { id: "templates", label: "Message Templates" },
  { id: "history", label: "Message History" },
];
const emptyCampaign = {
  title: "",
  channel: "email" as Channel,
  audience: "all_members" as Audience,
  department: "",
  roleName: "",
  recipientMemberId: "",
  recipientVisitorId: "",
  reminderType: "general" as ReminderType,
  subject: "",
  message: "",
  scheduledAt: "",
};
const emptyTemplate = { name: "", channel: "email" as Channel, subject: "", body: "" };
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";
const textareaClass = "mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function channelTone(channel: Channel) {
  if (channel === "email") return "blue";
  if (channel === "whatsapp") return "green";
  return "gold";
}

function statusTone(status: string) {
  if (status === "sent" || status === "delivered" || status === "opened") return "green";
  if (status === "failed") return "red";
  if (status === "scheduled" || status === "pending") return "gold";
  return "slate";
}

function downloadWorkbook(name: string, worksheet: string, headers: string[], rows: string[][]) {
  const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
  const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
  const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${worksheet}"><Table>${row(headers)}${rows.map(row).join("")}</Table></Worksheet></Workbook>`;
  const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function CommunicationModule() {
  const [activeTab, setActiveTab] = useState<Tab>("compose");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [members, setMembers] = useState<RecipientOption[]>([]);
  const [visitors, setVisitors] = useState<RecipientOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [visitorFollowUps, setVisitorFollowUps] = useState<VisitorFollowUp[]>([]);
  const [baptismClasses, setBaptismClasses] = useState<BaptismClass[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);

  const canSend = roles.some((role) => managerRoles.includes(role));
  const onlyTreasurer = roles.includes("treasurer") && !roles.some((role) => role === "super_admin" || role === "secretary" || role === "pastor");
  const filteredDeliveries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return deliveries.filter((delivery) => !needle || [delivery.title, delivery.recipient, delivery.contact, delivery.channel, delivery.status, delivery.deliveryStatus].some((value) => value.toLowerCase().includes(needle)));
  }, [deliveries, query]);
  const stats = useMemo(() => ({
    messages: deliveries.filter((item) => item.status === "sent").length,
    email: deliveries.filter((item) => item.channel === "email" && item.status === "sent").length,
    whatsapp: deliveries.filter((item) => item.channel === "whatsapp" && item.status === "sent").length,
    sms: deliveries.filter((item) => item.channel === "sms" && item.status === "sent").length,
    failed: deliveries.filter((item) => item.status === "failed").length,
  }), [deliveries]);

  async function load() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    if (!supabase) {
      setRoles(["super_admin"]);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setRoles(normalizeRoles((roleRows ?? []).map(({ role }) => role)));

    const [departmentResult, memberResult, visitorResult, campaignResult, deliveryResult, templateResult, eventResult, followUpResult, baptismClassResult] = await Promise.all([
      supabase.from("departments").select("id, name, is_active").order("name"),
      supabase.from("members").select("id, member_id, full_name, first_name, last_name, email, phone").eq("status", "active").order("full_name"),
      supabase.from("visitors").select("id, visitor_number, full_name, email, phone, next_follow_up_date").order("visit_date", { ascending: false }),
      supabase.from("communication_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("communication_delivery_logs").select("*").order("created_at", { ascending: false }),
      supabase.from("communication_templates").select("*").eq("is_active", true).order("name"),
      supabase.from("events").select("id, title, starts_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(10),
      supabase.from("visitors").select("id, full_name, next_follow_up_date").not("next_follow_up_date", "is", null).order("next_follow_up_date").limit(10),
      supabase.from("baptism_classes").select("id, class_name, start_date, instructor").order("start_date", { ascending: false }).limit(10),
    ]);

    const migrationError = campaignResult.error ?? deliveryResult.error ?? templateResult.error;
    if (migrationError) setError(`${migrationError.message}. Apply migration 202606120001_communication_notification_center.sql in Supabase.`);

    setDepartments((departmentResult.data ?? []).map((department) => ({ id: department.id, name: department.name, isActive: Boolean(department.is_active) })));
    setMembers((memberResult.data ?? []).map((member) => ({
      id: member.id,
      name: member.full_name || `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.member_id || "Member",
      email: member.email ?? "",
      phone: member.phone ?? "",
      kind: "member",
    })));
    setVisitors((visitorResult.data ?? []).map((visitor) => ({
      id: visitor.id,
      name: visitor.full_name || visitor.visitor_number || "Visitor",
      email: visitor.email ?? "",
      phone: visitor.phone ?? "",
      kind: "visitor",
    })));
    setCampaigns((campaignResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      channel: row.channel,
      audience: row.target_audience,
      department: row.department_name ?? "",
      roleName: row.role_name ?? "",
      recipientMemberId: row.recipient_member_id ?? "",
      recipientVisitorId: row.recipient_visitor_id ?? "",
      reminderType: row.reminder_type ?? "general",
      subject: row.subject ?? "",
      message: row.message,
      scheduledAt: row.scheduled_at?.slice(0, 16) ?? "",
      status: row.status,
      recipientCount: row.recipient_count ?? 0,
      sentCount: row.sent_count ?? 0,
      failedCount: row.failed_count ?? 0,
    })));
    setDeliveries((deliveryResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.notification_title,
      channel: row.channel,
      recipient: row.recipient_name ?? "Recipient",
      contact: row.recipient_contact ?? "",
      status: row.status,
      deliveryStatus: row.delivery_status ?? row.status,
      sentAt: row.sent_at?.slice(0, 16) ?? row.created_at?.slice(0, 16) ?? "",
      error: row.error_message ?? row.delivery_log ?? "",
    })));
    setTemplates((templateResult.data ?? []).map((row) => ({ id: row.id, name: row.name, channel: row.channel, subject: row.subject ?? "", body: row.body })));
    setEvents((eventResult.data ?? []).map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at })));
    setVisitorFollowUps((followUpResult.data ?? []).map((visitor) => ({ id: visitor.id, fullName: visitor.full_name, nextFollowUpDate: visitor.next_follow_up_date ?? "" })));
    setBaptismClasses((baptismClassResult.data ?? []).map((item) => ({ id: item.id, className: item.class_name, startDate: item.start_date ?? "", instructor: item.instructor ?? "" })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setCampaignForm((current) => ({ ...current, channel: template.channel, subject: template.subject, message: template.body }));
  }

  function openReminder(reminderType: ReminderType, channel: Channel, title: string, message: string, subject = "") {
    setCampaignForm({ ...emptyCampaign, title, channel, subject, message, reminderType });
    setShowCampaign(true);
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) { setError("Members receive notifications only. You do not have permission to send messages."); return; }
    if (onlyTreasurer && campaignForm.reminderType !== "contribution_receipt") { setError("Treasurer access is limited to contribution receipt notifications."); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    if (supabase) {
      const { data, error: saveError } = await supabase.from("communication_campaigns").insert({
        title: campaignForm.title,
        channel: campaignForm.channel,
        target_audience: campaignForm.audience,
        recipient_member_id: campaignForm.audience === "individual" ? campaignForm.recipientMemberId || null : null,
        recipient_visitor_id: campaignForm.audience === "individual" ? campaignForm.recipientVisitorId || null : null,
        department_name: campaignForm.audience === "department" ? campaignForm.department || null : null,
        role_name: campaignForm.audience === "role" ? campaignForm.roleName || null : null,
        reminder_type: campaignForm.reminderType,
        subject: campaignForm.subject || null,
        message: campaignForm.message,
        scheduled_at: campaignForm.scheduledAt || null,
        status: campaignForm.scheduledAt ? "scheduled" : "draft",
      }).select("id").single();
      if (saveError) { setError(saveError.message); setSaving(false); return; }
      setNotice("Message campaign saved.");
      if (data && !campaignForm.scheduledAt) await sendCampaign(data.id);
    }
    setCampaignForm(emptyCampaign);
    setShowCampaign(false);
    setSaving(false);
    await load();
  }

  async function sendCampaign(campaignId: string) {
    const response = await fetch("/api/communications/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to send message.");
    else setNotice(result.message ?? "Message processed.");
    await load();
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) { setError("You do not have permission to save templates."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { error: saveError } = await supabase.from("communication_templates").insert(templateForm);
      if (saveError) { setError(saveError.message); setSaving(false); return; }
    }
    setTemplateForm(emptyTemplate);
    setShowTemplate(false);
    setNotice("Template saved.");
    setSaving(false);
    await load();
  }

  function exportExcel() {
    downloadWorkbook(
      "Hamburg-Ghana-SDA-Message-History.xls",
      "Messages",
      ["Date", "Title", "Recipient", "Contact", "Channel", "Status", "Delivery Status", "Error"],
      filteredDeliveries.map((item) => [item.sentAt, item.title, item.recipient, item.contact, label(item.channel), label(item.status), label(item.deliveryStatus), item.error]),
    );
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church - Communication & Notification Center", 14, 16);
    document.setFontSize(9);
    document.text(`Messages: ${stats.messages} | Email: ${stats.email} | WhatsApp: ${stats.whatsapp} | SMS: ${stats.sms} | Failed: ${stats.failed}`, 14, 23);
    autoTableModule.default(document, {
      startY: 29,
      head: [["Date", "Title", "Recipient", "Channel", "Status", "Delivery", "Details"]],
      body: filteredDeliveries.map((item) => [item.sentAt, item.title, item.recipient, label(item.channel), label(item.status), label(item.deliveryStatus), item.error]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save("Hamburg-Ghana-SDA-Message-History.pdf");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <PageHeading title="Communication & Notification Center" description="Send bulk Email, WhatsApp, and SMS notifications to members, visitors, departments, and church roles." />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> Export PDF</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
          {canSend && <Button onClick={() => setShowCampaign(true)}><Send className="h-4 w-4" /> New Message</Button>}
        </div>
      </div>
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {!canSend && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Member accounts receive notifications only. Message sending tools are hidden for your role.</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={BellRing} label="Messages Sent" value={stats.messages} tone="bg-blue-50 text-churchblue" />
        <Metric icon={Mail} label="Emails Sent" value={stats.email} tone="bg-cyan-50 text-cyan-700" />
        <Metric icon={MessageCircle} label="WhatsApp Sent" value={stats.whatsapp} tone="bg-emerald-50 text-emerald-700" />
        <Metric icon={Smartphone} label="SMS Sent" value={stats.sms} tone="bg-amber-50 text-amber-700" />
        <Metric icon={X} label="Failed Deliveries" value={stats.failed} tone="bg-rose-50 text-rose-700" />
      </section>

      <Card className="overflow-hidden">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
          {tabs.map((tab) => <button className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-churchblue text-white" : "text-slate-600 hover:bg-slate-100"}`} key={tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </div>
        {activeTab === "compose" && <ComposeTab campaigns={campaigns} canSend={canSend} onAdd={() => setShowCampaign(true)} onSend={sendCampaign} />}
        {activeTab === "reminders" && <RemindersTab events={events} visitors={visitorFollowUps} baptismClasses={baptismClasses} onReminder={openReminder} />}
        {activeTab === "templates" && <TemplatesTab templates={templates} canSend={canSend} onAdd={() => setShowTemplate(true)} />}
        {activeTab === "history" && <HistoryTab deliveries={filteredDeliveries} loading={loading} query={query} setQuery={setQuery} />}
      </Card>

      {showCampaign && <CampaignModal departments={departments} form={campaignForm} setForm={setCampaignForm} saving={saving} members={members} visitors={visitors} templates={templates} onTemplate={applyTemplate} onClose={() => setShowCampaign(false)} onSubmit={saveCampaign} />}
      {showTemplate && <TemplateModal form={templateForm} setForm={setTemplateForm} saving={saving} onClose={() => setShowTemplate(false)} onSubmit={saveTemplate} />}
    </div>
  );
}

function Metric({ icon: Icon, label: text, value, tone }: { icon: typeof BellRing; label: string; value: number; tone: string }) {
  return <Card className="p-5"><div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div><p className="text-sm font-semibold text-slate-500">{text}</p><p className="mt-1 text-2xl font-bold text-navy">{value}</p></Card>;
}

function ComposeTab({ campaigns, canSend, onAdd, onSend }: { campaigns: Campaign[]; canSend: boolean; onAdd: () => void; onSend: (id: string) => void }) {
  return <div className="p-4"><SectionHeader title="Bulk Messaging Campaigns" action={canSend ? <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> Compose</Button> : null} /><div className="grid gap-4 lg:grid-cols-2">{campaigns.map((campaign) => <article className="rounded-xl border border-slate-100 p-4" key={campaign.id}><div className="flex items-start justify-between gap-3"><div><StatusBadge tone={channelTone(campaign.channel)}>{label(campaign.channel)}</StatusBadge><h3 className="mt-3 font-bold text-navy">{campaign.title}</h3><p className="mt-1 text-xs text-slate-400">{label(campaign.reminderType)} · {label(campaign.audience)}{campaign.roleName ? ` · ${label(campaign.roleName)}` : ""}</p></div><StatusBadge tone={statusTone(campaign.status)}>{label(campaign.status)}</StatusBadge></div><p className="mt-3 text-sm leading-6 text-slate-600">{campaign.message}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-xs font-semibold text-slate-400">{campaign.recipientCount} recipients · {campaign.sentCount} sent · {campaign.failedCount} failed</p>{canSend && <Button size="sm" variant="outline" onClick={() => onSend(campaign.id)}><Send className="h-4 w-4" /> Send / Retry</Button>}</div></article>)}{campaigns.length === 0 && <Empty text="No message campaigns yet." />}</div></div>;
}

function RemindersTab({ events, visitors, baptismClasses, onReminder }: { events: EventOption[]; visitors: VisitorFollowUp[]; baptismClasses: BaptismClass[]; onReminder: (type: ReminderType, channel: Channel, title: string, message: string, subject?: string) => void }) {
  return <div className="grid gap-4 p-4 xl:grid-cols-3"><ReminderPanel title="Upcoming Events" icon={<CalendarClock className="h-5 w-5" />} rows={events.map((event) => ({ id: event.id, title: event.title, note: event.startsAt.slice(0, 16).replace("T", " "), action: () => onReminder("event_reminder", "email", `Reminder: ${event.title}`, `Dear {{name}}, this is a reminder that ${event.title} is scheduled for ${event.startsAt.slice(0, 16).replace("T", " ")}.`, `Reminder: ${event.title}`) }))} /><ReminderPanel title="Visitor Follow-ups" icon={<UsersRound className="h-5 w-5" />} rows={visitors.map((visitor) => ({ id: visitor.id, title: visitor.fullName, note: visitor.nextFollowUpDate, action: () => onReminder("visitor_follow_up", "whatsapp", `Follow-up: ${visitor.fullName}`, `Hello ${visitor.fullName}, thank you for visiting Hamburg Ghana SDA Church. We hope to see you again soon.`) }))} /><ReminderPanel title="Birthdays & Classes" icon={<Cake className="h-5 w-5" />} rows={[{ id: "birthdays", title: "Birthday Greetings", note: "Send to all members with birthdays", action: () => onReminder("birthday_greeting", "email", "Birthday Greetings", "Dear {{name}}, happy birthday. Hamburg Ghana SDA Church celebrates you today.", "Happy Birthday") }, ...baptismClasses.map((item) => ({ id: item.id, title: item.className, note: item.startDate || item.instructor, action: () => onReminder("baptism_class_reminder", "sms", `Baptism Class: ${item.className}`, `Reminder: ${item.className} is scheduled for ${item.startDate || "the next class date"}. Hamburg Ghana SDA Church.`) }))]} /></div>;
}

function ReminderPanel({ title, icon, rows }: { title: string; icon: ReactNode; rows: { id: string; title: string; note: string; action: () => void }[] }) {
  return <Card className="p-5"><div className="mb-4 flex items-center gap-3"><div className="rounded-lg bg-blue-50 p-3 text-churchblue">{icon}</div><h2 className="font-bold text-navy">{title}</h2></div><div className="space-y-3">{rows.map((row) => <div className="rounded-lg border border-slate-100 p-3" key={row.id}><p className="font-semibold text-navy">{row.title}</p><p className="mt-1 text-xs text-slate-400">{row.note || "Ready to schedule"}</p><Button className="mt-3" size="sm" variant="outline" onClick={row.action}>Create Reminder</Button></div>)}{rows.length === 0 && <Empty text="No reminder records found." />}</div></Card>;
}

function TemplatesTab({ templates, canSend, onAdd }: { templates: Template[]; canSend: boolean; onAdd: () => void }) {
  return <div className="p-4"><SectionHeader title="Message Templates" action={canSend ? <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> Add Template</Button> : null} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <article className="rounded-xl border border-slate-100 p-4" key={template.id}><StatusBadge tone={channelTone(template.channel)}>{label(template.channel)}</StatusBadge><h3 className="mt-3 font-bold text-navy">{template.name}</h3>{template.subject && <p className="mt-1 text-xs font-semibold text-slate-400">{template.subject}</p>}<p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{template.body}</p></article>)}{templates.length === 0 && <Empty text="No templates found. Run the communication notification center migration to seed defaults." />}</div></div>;
}

function HistoryTab({ deliveries, loading, query, setQuery }: { deliveries: Delivery[]; loading: boolean; query: string; setQuery: (value: string) => void }) {
  return <div className="p-4"><div className="mb-4 flex h-10 max-w-md items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search sent, failed, or delivered messages..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{["Date", "Recipient", "Channel", "Status", "Delivery Status", "Details"].map((heading) => <th className="px-4 py-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead><tbody>{loading && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={6}>Loading message history...</td></tr>}{deliveries.map((item) => <tr className="border-b border-slate-100 last:border-0" key={item.id}><td className="px-4 py-4 text-slate-600">{item.sentAt}</td><td className="px-4 py-4"><p className="font-semibold text-navy">{item.recipient}</p><p className="text-xs text-slate-400">{item.contact || "No contact recorded"}</p></td><td className="px-4 py-4"><StatusBadge tone={channelTone(item.channel)}>{label(item.channel)}</StatusBadge></td><td className="px-4 py-4"><StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge></td><td className="px-4 py-4"><StatusBadge tone={statusTone(item.deliveryStatus)}>{label(item.deliveryStatus)}</StatusBadge></td><td className="px-4 py-4 text-slate-500">{item.error || item.title}</td></tr>)}{!loading && deliveries.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={6}>No message history found.</td></tr>}</tbody></table></div></div>;
}

function SectionHeader({ title, action }: { title: string; action: ReactNode }) {
  return <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><h2 className="font-bold text-navy">{title}</h2>{action}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">{text}</div>;
}

function CampaignModal({ departments, form, setForm, saving, members, visitors, templates, onTemplate, onClose, onSubmit }: { departments: DepartmentOption[]; form: typeof emptyCampaign; setForm: (form: typeof emptyCampaign) => void; saving: boolean; members: RecipientOption[]; visitors: RecipientOption[]; templates: Template[]; onTemplate: (id: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Compose Message" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><Input label="Campaign Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required /><Select label="Channel" value={form.channel} onChange={(value) => setForm({ ...form, channel: value as Channel })} options={channelOptions} /><Select label="Message Type" value={form.reminderType} onChange={(value) => setForm({ ...form, reminderType: value as ReminderType })} options={reminderOptions} /><Select label="Bulk Audience" value={form.audience} onChange={(value) => setForm({ ...form, audience: value as Audience, department: "", roleName: "", recipientMemberId: "", recipientVisitorId: "" })} options={["all_members", "all_visitors", "department", "role", "individual"]} /><label className="text-sm font-semibold text-slate-700">Department<select className={fieldClass} disabled={form.audience !== "department"} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}><option value="">{form.audience === "department" ? "Select department" : "Choose department audience first"}</option>{departments.map((department) => <option disabled={!department.isActive} key={department.id} value={department.name}>{department.name}</option>)}</select></label><Select label="Role" disabled={form.audience !== "role"} value={form.roleName} onChange={(value) => setForm({ ...form, roleName: value })} options={["", ...roleOptions]} /><label className="text-sm font-semibold text-slate-700">Individual Member<select className={fieldClass} disabled={form.audience !== "individual" || Boolean(form.recipientVisitorId)} value={form.recipientMemberId} onChange={(event) => setForm({ ...form, recipientMemberId: event.target.value, recipientVisitorId: "" })}><option value="">Select member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Individual Visitor<select className={fieldClass} disabled={form.audience !== "individual" || Boolean(form.recipientMemberId)} value={form.recipientVisitorId} onChange={(event) => setForm({ ...form, recipientVisitorId: event.target.value, recipientMemberId: "" })}><option value="">Select visitor</option>{visitors.map((visitor) => <option key={visitor.id} value={visitor.id}>{visitor.name}</option>)}</select></label><Input label="Schedule Date" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm({ ...form, scheduledAt: value })} /><Input label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Use Template<select className={fieldClass} onChange={(event) => onTemplate(event.target.value)}><option value="">Choose template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Message<textarea className={textareaClass} required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label><p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 sm:col-span-2">SMS gateway support is optional. If Email, WhatsApp, or SMS credentials are not configured, the system records failed delivery logs with provider setup details.</p></div><ModalActions saving={saving} label="Save / Send" onClose={onClose} /></form></Modal>;
}

function TemplateModal({ form, setForm, saving, onClose, onSubmit }: { form: typeof emptyTemplate; setForm: (form: typeof emptyTemplate) => void; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Create Message Template" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><Input label="Template Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><Select label="Channel" value={form.channel} onChange={(value) => setForm({ ...form, channel: value as Channel })} options={channelOptions} /><Input label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Body<textarea className={textareaClass} required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label></div><ModalActions saving={saving} label="Save Template" onClose={onClose} /></form></Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5"><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church notification center</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close communication form" onClick={onClose}><X className="h-5 w-5" /></Button></div>{children}</div></div>;
}

function ModalActions({ saving, label: actionLabel, onClose }: { saving: boolean; label: string; onClose: () => void }) {
  return <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : actionLabel}</Button></div>;
}

function Input({ label: inputLabel, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-sm font-semibold text-slate-700">{inputLabel}<input className={fieldClass} required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label: selectLabel, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: string[]; disabled?: boolean }) {
  return <label className="text-sm font-semibold text-slate-700">{selectLabel}<select className={fieldClass} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option ? label(option) : "Select option"}</option>)}</select></label>;
}
