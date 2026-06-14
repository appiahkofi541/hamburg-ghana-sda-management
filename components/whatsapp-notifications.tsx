"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellRing, Cake, CalendarClock, CheckCircle2, HeartHandshake,
  Megaphone, MessageCircle, Plus, Send, Settings2, Users, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type CampaignType = "announcement" | "event_reminder" | "birthday" | "prayer_update";
type CampaignStatus = "draft" | "queued" | "sending" | "sent" | "partially_failed" | "failed";
type CampaignAudience = "all_opted_in_members" | "all_members" | "birthday_members" | "event_attendees" | "manual";
type Campaign = {
  id: string;
  type: CampaignType;
  title: string;
  messagePreview: string;
  messageBody: string;
  templateName: string;
  audience: CampaignAudience;
  scheduledAt: string;
  status: CampaignStatus;
  recipients: number;
  sent: number;
  failed: number;
  createdAt: string;
};
type CampaignForm = {
  type: CampaignType;
  title: string;
  audience: CampaignAudience;
  messageBody: string;
  messagePreview: string;
  templateName: string;
  templateLanguage: string;
  templateParameters: string;
  scheduledAt: string;
  status: CampaignStatus;
};
type MemberContact = { id: string; name: string; phone: string; whatsappPhone: string; optedIn: boolean };

const disabledMessage = "WhatsApp sending is disabled until WhatsApp Business API credentials are configured.";
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const textareaClass = "mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue";
const campaignMeta: Record<CampaignType, { label: string; description: string; icon: LucideIcon; tone: string }> = {
  announcement: { label: "Broadcast Announcements", description: "Share approved church news and ministry updates.", icon: Megaphone, tone: "bg-blue-50 text-churchblue" },
  event_reminder: { label: "Event Reminders", description: "Remind members about services and church programs.", icon: CalendarClock, tone: "bg-amber-50 text-amber-700" },
  birthday: { label: "Birthday Messages", description: "Send thoughtful greetings to opted-in members.", icon: Cake, tone: "bg-purple-50 text-purple-700" },
  prayer_update: { label: "Prayer Updates", description: "Share approved prayer ministry encouragement.", icon: HeartHandshake, tone: "bg-emerald-50 text-emerald-700" },
};
const audienceOptions: Array<{ value: CampaignAudience; label: string }> = [
  { value: "all_opted_in_members", label: "All opted-in members" },
  { value: "all_members", label: "All members" },
  { value: "birthday_members", label: "Birthday members" },
  { value: "event_attendees", label: "Event attendees" },
  { value: "manual", label: "Manual selection" },
];
const statusOptions: CampaignStatus[] = ["draft", "queued", "sent", "failed"];
const emptyForm: CampaignForm = {
  type: "announcement",
  title: "",
  audience: "all_opted_in_members",
  messageBody: "",
  messagePreview: "",
  templateName: "",
  templateLanguage: "en",
  templateParameters: "",
  scheduledAt: "",
  status: "draft",
};
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const fallbackTemplateName = (form: CampaignForm) => (form.templateName.trim() || form.type).replace(/[^a-z0-9_]/gi, "_").toLowerCase();

export function WhatsAppNotifications() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [optedInCount, setOptedInCount] = useState(0);
  const [members, setMembers] = useState<MemberContact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState("");
  const [whatsappConfigured, setWhatsappConfigured] = useState(true);

  async function load() {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Add the project URL and anonymous key to use WhatsApp notifications.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: rows, error: campaignError }, { data: memberRows, error: memberError }, { data: contactRows, error: contactError }, configResponse] = await Promise.all([
      supabase.from("whatsapp_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("members").select("id, full_name, phone").eq("status", "active").order("full_name"),
      supabase.from("whatsapp_contacts").select("member_id, phone, opted_in"),
      fetch("/api/whatsapp/send", { cache: "no-store" }),
    ]);
    if (configResponse.ok) {
      const config = await configResponse.json() as { configured?: boolean };
      setWhatsappConfigured(Boolean(config.configured));
    }
    if (campaignError || memberError || contactError) setError(campaignError?.message ?? memberError?.message ?? contactError?.message ?? "Unable to load WhatsApp notifications.");
    else {
      setError("");
      setCampaigns((rows ?? []).map((row) => ({
        id: row.id,
        type: row.campaign_type,
        title: row.title,
        messagePreview: row.message_preview,
        messageBody: row.message_body ?? row.message_preview,
        templateName: row.template_name,
        audience: row.target_audience ?? "all_opted_in_members",
        scheduledAt: row.scheduled_at ?? "",
        status: row.status,
        recipients: row.recipient_count,
        sent: row.sent_count,
        failed: row.failed_count,
        createdAt: row.created_at.slice(0, 10),
      })));
      const savedContacts = new Map((contactRows ?? []).map((contact) => [contact.member_id, contact]));
      const contacts = (memberRows ?? []).map((row) => ({ id: row.id, name: row.full_name, phone: row.phone ?? "", whatsappPhone: savedContacts.get(row.id)?.phone ?? "", optedIn: savedContacts.get(row.id)?.opted_in ?? false }));
      setMembers(contacts);
      setOptedInCount(contacts.filter(({ optedIn, whatsappPhone }) => optedIn && whatsappPhone.trim()).length);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const sentCount = useMemo(() => campaigns.reduce((sum, campaign) => sum + campaign.sent, 0), [campaigns]);
  const queuedCount = useMemo(() => campaigns.filter(({ status }) => status === "queued" || status === "sending").length, [campaigns]);

  async function saveCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(form.title, "Campaign title") || required(form.messageBody || form.messagePreview, "Message/template");
    if (validationError) {
      setModalError(validationError);
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError("");
    setModalError("");
    const parameters = form.templateParameters.split(",").map((value) => value.trim()).filter(Boolean);
    const messageBody = form.messageBody.trim();
    const messagePreview = (form.messagePreview.trim() || messageBody).slice(0, 220);
    const { error: saveError } = await supabase.from("whatsapp_campaigns").insert({
      campaign_type: form.type,
      title: form.title.trim(),
      target_audience: form.audience,
      message_body: messageBody,
      message_preview: messagePreview,
      template_name: fallbackTemplateName(form),
      template_language: form.templateLanguage.trim() || "en",
      template_parameters: parameters,
      scheduled_at: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      status: form.status,
    });
    if (saveError) {
      setModalError(saveError.message);
    } else {
      setNotice(whatsappConfigured ? "WhatsApp campaign saved." : `Campaign saved as a draft. ${disabledMessage}`);
      setForm(emptyForm);
      setShowForm(false);
      await load();
    }
    setSaving(false);
  }

  async function sendCampaign(campaign: Campaign) {
    setNotice("");
    setError("");
    if (optedInCount === 0) {
      setError("No opted-in WhatsApp recipients found.");
      return;
    }
    if (!whatsappConfigured) {
      setError(disabledMessage);
      return;
    }
    setSendingId(campaign.id);
    const response = await fetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: campaign.id }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to send WhatsApp campaign.");
    else setNotice(`WhatsApp delivery finished: ${result.sent} sent, ${result.failed} failed.`);
    setSendingId("");
    await load();
  }

  async function saveContact(contact: MemberContact) {
    const phone = contact.whatsappPhone.trim();
    if (contact.optedIn && !phone) { setError("Add a WhatsApp phone number before recording consent."); return; }
    const supabase = createClient(); if (!supabase) return;
    const { error: updateError } = await supabase.from("whatsapp_contacts").upsert({ member_id: contact.id, phone: phone || null, opted_in: contact.optedIn, consent_at: contact.optedIn ? new Date().toISOString() : null });
    if (updateError) setError(updateError.message);
    else { setNotice(`${contact.name}'s WhatsApp consent updated.`); setError(""); await load(); }
  }

  return <div className="space-y-6">
    <PageHeading title="WhatsApp Notifications" description="Send approved church communications with WhatsApp Business Cloud API." />
    {!whatsappConfigured && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{disabledMessage}</p>}
    {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
    {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(campaignMeta).map(([type, { label, description, icon: Icon, tone }]) => <Card className="p-5" key={type}><div className={`inline-flex rounded-lg p-3 ${tone}`}><Icon className="h-5 w-5" /></div><h2 className="mt-4 font-bold text-navy">{label}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></Card>)}
    </section>
    <section className="grid gap-4 md:grid-cols-3">
      <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-green-50 p-3 text-green-700"><Users className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">Opted-in Members</p><p className="mt-1 text-xl font-bold text-navy">{optedInCount}</p></div></Card>
      <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">Messages Sent</p><p className="mt-1 text-xl font-bold text-navy">{sentCount}</p></div></Card>
      <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-amber-50 p-3 text-amber-700"><BellRing className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">Queued Campaigns</p><p className="mt-1 text-xl font-bold text-navy">{queuedCount}</p></div></Card>
    </section>
    <Card className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><h2 className="font-bold text-navy">Communication Campaigns</h2><p className="mt-1 text-sm text-slate-500">Save drafts anytime. Sending requires server-side WhatsApp Business API credentials.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setError(""); setShowContacts(true); }}><Settings2 className="h-4 w-4" /> Manage Consent</Button><Button onClick={() => { setModalError(""); setForm(emptyForm); setShowForm(true); }}><Plus className="h-4 w-4" /> New Campaign</Button></div></Card>
    <Card><div className="border-b border-slate-100 p-4"><h2 className="font-bold text-navy">Recent Campaigns</h2></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">Loading WhatsApp campaigns...</p> : campaigns.length === 0 ? <div className="p-12 text-center"><MessageCircle className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-500">No WhatsApp campaigns have been created.</p></div> : <div className="grid gap-4 p-4 lg:grid-cols-2">{campaigns.map((campaign) => <CampaignCard campaign={campaign} key={campaign.id} sending={sendingId === campaign.id} sendingEnabled={whatsappConfigured} onSend={sendCampaign} />)}</div>}</Card>
    {showForm && <CampaignModal error={modalError} form={form} saving={saving} sendingEnabled={whatsappConfigured} onClose={() => setShowForm(false)} onForm={setForm} onSubmit={saveCampaign} />}
    {showContacts && <ContactModal members={members} onClose={() => setShowContacts(false)} onSave={saveContact} />}
  </div>;
}

function ContactModal({ members, onClose, onSave }: { members: MemberContact[]; onClose: () => void; onSave: (contact: MemberContact) => void }) {
  const [contacts, setContacts] = useState(members);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">WhatsApp Consent</h2><p className="mt-1 text-xs text-slate-400">Record explicit member consent before messaging.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close contacts" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="space-y-3 overflow-y-auto p-5">{contacts.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No active members found.</p> : contacts.map((contact) => <div className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[minmax(0,1fr)_15rem_auto_auto] md:items-center" key={contact.id}><div><p className="text-sm font-bold text-navy">{contact.name}</p><p className="mt-1 text-xs text-slate-400">{contact.phone || "No member phone recorded"}</p></div><input aria-label={`WhatsApp phone for ${contact.name}`} className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-churchblue" placeholder="491234567890" value={contact.whatsappPhone} onChange={(event) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, whatsappPhone: event.target.value } : item))} /><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input checked={contact.optedIn} className="accent-churchblue" type="checkbox" onChange={(event) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, optedIn: event.target.checked } : item))} /> Opted in</label><Button size="sm" variant="outline" onClick={() => onSave(contact)}>Save</Button></div>)}</div><div className="flex justify-end border-t border-slate-100 p-4"><Button onClick={onClose}>Done</Button></div></div></div>;
}

function CampaignCard({ campaign, sending, sendingEnabled, onSend }: { campaign: Campaign; sending: boolean; sendingEnabled: boolean; onSend: (campaign: Campaign) => void }) {
  const meta = campaignMeta[campaign.type];
  const Icon = meta.icon;
  const tone = campaign.status === "sent" ? "green" : campaign.status === "failed" || campaign.status === "partially_failed" ? "red" : campaign.status === "queued" || campaign.status === "sending" ? "gold" : "slate";
  const scheduledText = campaign.scheduledAt ? `Scheduled: ${new Date(campaign.scheduledAt).toLocaleString()}` : "No schedule";
  return <article className="rounded-xl border border-slate-100 p-5"><div className="flex items-start justify-between gap-3"><div className={`rounded-lg p-3 ${meta.tone}`}><Icon className="h-5 w-5" /></div><StatusBadge tone={tone}>{pretty(campaign.status)}</StatusBadge></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-green-700">{meta.label}</p><h3 className="mt-1 font-bold text-navy">{campaign.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{campaign.messageBody || campaign.messagePreview}</p><p className="mt-4 text-xs text-slate-400">Audience: {pretty(campaign.audience)} · Template: {campaign.templateName} · {scheduledText} · Created {campaign.createdAt}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs font-semibold text-slate-400">{campaign.recipients} recipients · {campaign.sent} sent · {campaign.failed} failed</p><Button disabled={sending || campaign.status === "sending"} size="sm" title={sendingEnabled ? undefined : disabledMessage} onClick={() => onSend(campaign)}><Send className="h-4 w-4" /> {sending ? "Sending..." : campaign.status === "sent" ? "Send Again" : "Send Campaign"}</Button></div></article>;
}

function CampaignModal({ error, form, saving, sendingEnabled, onClose, onForm, onSubmit }: { error: string; form: CampaignForm; saving: boolean; sendingEnabled: boolean; onClose: () => void; onForm: (form: CampaignForm) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">New WhatsApp Campaign</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church communications</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={onClose}><X className="h-5 w-5" /></Button></div>{!sendingEnabled && <p className="mx-5 mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{disabledMessage}</p>}{error && <p className="mx-5 mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}<div className="grid gap-4 p-5 sm:grid-cols-2">
    <label className="text-sm font-semibold text-slate-700">Message type<select className={fieldClass} value={form.type} onChange={(event) => onForm({ ...form, type: event.target.value as CampaignType })}>{Object.entries(campaignMeta).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">Audience<select className={fieldClass} value={form.audience} onChange={(event) => onForm({ ...form, audience: event.target.value as CampaignAudience })}>{audienceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">Campaign title<input className={fieldClass} required value={form.title} onChange={(event) => onForm({ ...form, title: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700">Status<select className={fieldClass} value={form.status} onChange={(event) => onForm({ ...form, status: event.target.value as CampaignStatus })}>{statusOptions.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">Schedule date optional<input className={fieldClass} type="datetime-local" value={form.scheduledAt} onChange={(event) => onForm({ ...form, scheduledAt: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700">Template language<input className={fieldClass} value={form.templateLanguage} onChange={(event) => onForm({ ...form, templateLanguage: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Message / template<textarea className={textareaClass} required value={form.messageBody} onChange={(event) => onForm({ ...form, messageBody: event.target.value, messagePreview: event.target.value.slice(0, 220) })} /></label>
    <label className="text-sm font-semibold text-slate-700">Meta-approved template name<input className={fieldClass} placeholder="church_announcement" value={form.templateName} onChange={(event) => onForm({ ...form, templateName: event.target.value })} /></label>
    <label className="text-sm font-semibold text-slate-700">Body parameters<input className={fieldClass} placeholder="Value 1, Value 2" value={form.templateParameters} onChange={(event) => onForm({ ...form, templateParameters: event.target.value })} /></label>
    <p className="rounded-lg bg-green-50 px-3 py-2 text-xs leading-5 text-green-800 sm:col-span-2">Draft campaigns can be saved now. Sending uses active members with recorded WhatsApp consent and requires server-side WhatsApp credentials.</p>
  </div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit"><MessageCircle className="h-4 w-4" /> {saving ? "Saving..." : "Save Draft"}</Button></div></form></div>;
}
