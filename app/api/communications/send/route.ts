import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeRoles, toAppRole, type AppRole } from "@/lib/auth";

const senderRoles = new Set<AppRole>(["super_admin", "pastor", "secretary", "treasurer"]);
const roleRecipients = new Set(["pastor", "elder", "secretary", "treasurer", "member"]);

type MemberRecipient = {
  kind: "member";
  id: string;
  name: string;
  contact: string;
  role?: string;
};

type VisitorRecipient = {
  kind: "visitor";
  id: string;
  name: string;
  contact: string;
};

type Recipient = MemberRecipient | VisitorRecipient;

function providerConfigured(channel: string) {
  if (channel === "email") return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
  if (channel === "whatsapp") return Boolean(process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN && process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID);
  if (channel === "sms") return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  if (channel === "push") return Boolean(process.env.PUSH_NOTIFICATION_SERVER_KEY);
  return false;
}

function providerMessage(channel: string) {
  if (channel === "email") return "Email integration not configured yet. Add RESEND_API_KEY or SMTP settings on the server.";
  if (channel === "whatsapp") return "WhatsApp integration not configured yet. Add WhatsApp Business Cloud API credentials on the server.";
  if (channel === "sms") return "SMS integration not configured yet. Add Twilio credentials on the server.";
  if (channel === "push") return "Push notification integration not configured yet.";
  return "Notification provider is not configured yet.";
}

function memberName(member: { full_name?: string | null; first_name?: string | null; last_name?: string | null; member_id?: string | null }) {
  return member.full_name || `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.member_id || "Member";
}

function memberContact(member: { email?: string | null; phone?: string | null }, channel: string) {
  return channel === "email" ? member.email ?? "" : member.phone ?? "";
}

function visitorContact(visitor: { email?: string | null; phone?: string | null }, channel: string) {
  return channel === "email" ? visitor.email ?? "" : visitor.phone ?? "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
  if (!roles.some((role) => senderRoles.has(role))) {
    return NextResponse.json({ error: "Access denied. Only Super Admin, Pastor, Secretary, or Treasurer can send notifications." }, { status: 403 });
  }

  const body = await request.json() as { campaignId?: string };
  if (!body.campaignId) return NextResponse.json({ error: "Campaign ID is required." }, { status: 400 });

  const { data: campaign, error: campaignError } = await supabase.from("communication_campaigns").select("*").eq("id", body.campaignId).single();
  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message ?? "Campaign not found." }, { status: 404 });

  const onlyTreasurer = roles.includes("treasurer") && !roles.some((role) => role === "super_admin" || role === "secretary" || role === "pastor");
  if (onlyTreasurer && campaign.reminder_type !== "contribution_receipt") {
    return NextResponse.json({ error: "Treasurer access is limited to contribution receipt notifications." }, { status: 403 });
  }

  const recipients: Recipient[] = [];

  if (campaign.target_audience === "all_visitors") {
    const { data, error } = await supabase.from("visitors").select("id, visitor_number, full_name, email, phone").order("visit_date", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    recipients.push(...(data ?? []).map((visitor) => ({
      kind: "visitor" as const,
      id: visitor.id,
      name: visitor.full_name || visitor.visitor_number || "Visitor",
      contact: visitorContact(visitor, campaign.channel),
    })));
  } else if (campaign.target_audience === "individual" && campaign.recipient_visitor_id) {
    const { data, error } = await supabase.from("visitors").select("id, visitor_number, full_name, email, phone").eq("id", campaign.recipient_visitor_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    recipients.push(...(data ?? []).map((visitor) => ({
      kind: "visitor" as const,
      id: visitor.id,
      name: visitor.full_name || visitor.visitor_number || "Visitor",
      contact: visitorContact(visitor, campaign.channel),
    })));
  } else if (campaign.target_audience === "role") {
    const requestedRole = toAppRole(campaign.role_name);
    if (!requestedRole || !roleRecipients.has(requestedRole)) return NextResponse.json({ error: "Select a valid recipient role." }, { status: 400 });
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_roles!inner(role), members(id, member_id, phone)")
      .eq("user_roles.role", requestedRole);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    recipients.push(...(data ?? []).map((profile) => {
      const member = Array.isArray(profile.members) ? profile.members[0] : profile.members;
      return {
        kind: "member" as const,
        id: member?.id ?? profile.id,
        name: profile.full_name || profile.email || requestedRole,
        contact: campaign.channel === "email" ? profile.email ?? "" : member?.phone ?? "",
        role: requestedRole,
      };
    }));
  } else {
    const membersQuery = supabase
      .from("members")
      .select("id, member_id, full_name, first_name, last_name, email, phone, department_members(departments(name))")
      .eq("status", "active");
    const { data, error } = campaign.target_audience === "individual" && campaign.recipient_member_id
      ? await membersQuery.eq("id", campaign.recipient_member_id)
      : await membersQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    recipients.push(...(data ?? []).filter((member) => {
      const membership = Array.isArray(member.department_members) ? member.department_members[0] : undefined;
      const department = Array.isArray(membership?.departments) ? membership.departments[0] : membership?.departments;
      if (campaign.target_audience === "department") return department?.name === campaign.department_name;
      return true;
    }).map((member) => ({
      kind: "member" as const,
      id: member.id,
      name: memberName(member),
      contact: memberContact(member, campaign.channel),
    })));
  }

  if (!recipients.length) return NextResponse.json({ error: "No recipients found for this campaign." }, { status: 400 });

  const configured = providerConfigured(campaign.channel);
  const logs = recipients.map((recipient) => {
    const missingContact = !recipient.contact && campaign.channel !== "push";
    const status = configured && !missingContact ? "sent" : "failed";
    const errorMessage = missingContact ? `Recipient has no ${campaign.channel === "email" ? "email address" : "phone number"}.` : configured ? null : providerMessage(campaign.channel);
    return {
      campaign_id: campaign.id,
      member_id: recipient.kind === "member" ? recipient.id : null,
      visitor_id: recipient.kind === "visitor" ? recipient.id : null,
      notification_title: campaign.title,
      channel: campaign.channel,
      recipient_name: recipient.name,
      recipient_contact: recipient.contact || null,
      recipient_role: recipient.kind === "member" ? recipient.role ?? null : "visitor",
      status,
      delivery_status: status,
      error_message: errorMessage,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      delivered_at: status === "sent" ? new Date().toISOString() : null,
      delivery_log: status === "sent" ? "Provider delivery accepted." : errorMessage,
    };
  });

  const { error: logError } = await supabase.from("communication_delivery_logs").insert(logs);
  if (logError) return NextResponse.json({ error: logError.message }, { status: 400 });

  const sent = logs.filter((log) => log.status === "sent").length;
  const failed = logs.length - sent;
  const status = failed && !sent ? "failed" : "sent";
  await supabase.from("communication_campaigns").update({
    status,
    recipient_count: logs.length,
    sent_count: sent,
    failed_count: failed,
    sent_at: sent ? new Date().toISOString() : null,
  }).eq("id", campaign.id);

  return NextResponse.json({
    message: `${sent} sent, ${failed} failed.`,
    sent,
    failed,
  });
}
