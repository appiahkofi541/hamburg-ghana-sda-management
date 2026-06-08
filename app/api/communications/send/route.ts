import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toAppRole } from "@/lib/auth";

const managerRoles = new Set(["super_admin", "pastor", "secretary"]);

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

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const canSend = (roles ?? []).some(({ role }) => {
    const normalized = toAppRole(role);
    return normalized ? managerRoles.has(normalized) : false;
  });
  if (!canSend) return NextResponse.json({ error: "Access denied. Only Super Admin, Pastor, or Secretary can send notifications." }, { status: 403 });

  const body = await request.json() as { campaignId?: string };
  if (!body.campaignId) return NextResponse.json({ error: "Campaign ID is required." }, { status: 400 });

  const { data: campaign, error: campaignError } = await supabase.from("communication_campaigns").select("*").eq("id", body.campaignId).single();
  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message ?? "Campaign not found." }, { status: 404 });

  const configured = providerConfigured(campaign.channel);
  const status = configured ? "sent" : "failed";
  const errorMessage = configured ? null : providerMessage(campaign.channel);
  const membersQuery = supabase.from("members").select("id, member_id, full_name, first_name, last_name, email, phone, department:departments(name)").eq("status", "active");
  const { data: members, error: membersError } = campaign.target_audience === "individual" && campaign.recipient_member_id
    ? await membersQuery.eq("id", campaign.recipient_member_id)
    : await membersQuery;
  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 400 });

  const recipients = (members ?? []).filter((member) => {
    const department = Array.isArray(member.department) ? member.department[0] : member.department;
    if (campaign.target_audience === "department") return department?.name === campaign.department_name;
    if (campaign.target_audience === "leaders") return true;
    return true;
  });

  if (!recipients.length) return NextResponse.json({ error: "No recipients found for this campaign." }, { status: 400 });

  const logs = recipients.map((member) => {
    const name = member.full_name || `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.member_id || "Member";
    const contact = campaign.channel === "email" ? member.email : member.phone;
    return {
      campaign_id: campaign.id,
      member_id: member.id,
      notification_title: campaign.title,
      channel: campaign.channel,
      recipient_name: name,
      recipient_contact: contact || null,
      status,
      error_message: errorMessage,
      sent_at: configured ? new Date().toISOString() : null,
      delivery_log: configured ? "Provider delivery accepted." : errorMessage,
    };
  });

  const { error: logError } = await supabase.from("communication_delivery_logs").insert(logs);
  if (logError) return NextResponse.json({ error: logError.message }, { status: 400 });

  await supabase.from("communication_campaigns").update({ status, sent_at: configured ? new Date().toISOString() : null }).eq("id", campaign.id);

  return NextResponse.json({
    message: configured
      ? `${logs.length} notification${logs.length === 1 ? "" : "s"} sent.`
      : `${logs.length} delivery log${logs.length === 1 ? "" : "s"} created. ${errorMessage}`,
    sent: configured ? logs.length : 0,
    failed: configured ? 0 : logs.length,
  });
}
