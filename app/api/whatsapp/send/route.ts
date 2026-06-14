import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toAppRole } from "@/lib/auth";

const allowedRoles = new Set(["super_admin", "pastor", "elder", "church_clerk", "secretary"]);

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roleRows ?? []).some(({ role }) => {
    const appRole = toAppRole(role);
    return appRole ? allowedRoles.has(appRole) : false;
  })) return NextResponse.json({ error: "You do not have permission to send WhatsApp campaigns." }, { status: 403 });

  const { campaignId } = await request.json() as { campaignId?: string };
  if (!campaignId) return NextResponse.json({ error: "Campaign ID is required." }, { status: 400 });
  const { data: campaign, error: campaignError } = await supabase.from("whatsapp_campaigns").select("*").eq("id", campaignId).single();
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 404 });

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return NextResponse.json({ error: "WhatsApp sending is disabled until WhatsApp API credentials are configured." }, { status: 503 });

  const { data: members, error: membersError } = await supabase.from("whatsapp_contacts").select("member_id, phone, members!inner(status)").eq("opted_in", true).eq("members.status", "active");
  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });
  const recipients = (members ?? []).map((member) => ({ member_id: member.member_id, phone: normalizePhone(member.phone) })).filter(({ phone }) => phone.length >= 8);
  if (!recipients.length) return NextResponse.json({ error: "No active members have opted in with a valid WhatsApp phone number." }, { status: 400 });

  const { error: deliveryError } = await supabase.from("whatsapp_deliveries").upsert(recipients.map((recipient) => ({ campaign_id: campaign.id, ...recipient })), { onConflict: "campaign_id,member_id" });
  if (deliveryError) return NextResponse.json({ error: deliveryError.message }, { status: 500 });
  await supabase.from("whatsapp_campaigns").update({ status: "queued", recipient_count: recipients.length }).eq("id", campaign.id);

  await supabase.from("whatsapp_campaigns").update({ status: "sending" }).eq("id", campaign.id);
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
  const apiBaseUrl = process.env.WHATSAPP_GRAPH_API_BASE_URL || "https://graph.facebook.com";
  const parameters = (campaign.template_parameters as string[]).map((text) => ({ type: "text", text }));
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const body = {
      messaging_product: "whatsapp",
      to: recipient.phone,
      type: "template",
      template: {
        name: campaign.template_name,
        language: { code: campaign.template_language },
        ...(parameters.length ? { components: [{ type: "body", parameters }] } : {}),
      },
    };
    try {
      const response = await fetch(`${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "WhatsApp API request failed.");
      sent += 1;
      await supabase.from("whatsapp_deliveries").update({ status: "sent", provider_message_id: result.messages?.[0]?.id ?? null, sent_at: new Date().toISOString(), error_message: null }).eq("campaign_id", campaign.id).eq("member_id", recipient.member_id);
    } catch (error) {
      failed += 1;
      await supabase.from("whatsapp_deliveries").update({ status: "failed", error_message: error instanceof Error ? error.message : "WhatsApp API request failed." }).eq("campaign_id", campaign.id).eq("member_id", recipient.member_id);
    }
  }
  const status = failed === 0 ? "sent" : sent === 0 ? "failed" : "partially_failed";
  await supabase.from("whatsapp_campaigns").update({ status, sent_count: sent, failed_count: failed, sent_at: new Date().toISOString() }).eq("id", campaign.id);
  return NextResponse.json({ status, recipientCount: recipients.length, sent, failed });
}
