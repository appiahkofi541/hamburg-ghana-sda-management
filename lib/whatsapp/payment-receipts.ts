import type { SupabaseClient } from "@supabase/supabase-js";

type Settings = {
  phone_number_id: string | null;
  access_token: string | null;
  default_template_name: string | null;
  template_language: string | null;
  auto_notifications_enabled: boolean | null;
};

type PaymentRow = {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number | string;
  reference_number: string | null;
  member_id: string | null;
  members?: { full_name?: string | null; phone?: string | null } | { full_name?: string | null; phone?: string | null }[] | null;
};

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relatedMember(payment: PaymentRow) {
  const member = Array.isArray(payment.members) ? payment.members[0] : payment.members;
  return member ?? null;
}

export async function sendPaymentWhatsAppReceipt(admin: SupabaseClient, paymentId: string, options: { retry?: boolean } = {}) {
  const { data: payment, error: paymentError } = await admin
    .from("finance_transactions")
    .select("id, transaction_date, transaction_type, amount, reference_number, member_id, members(full_name, phone)")
    .eq("id", paymentId)
    .maybeSingle<PaymentRow>();
  if (paymentError) return { ok: false, status: 500, error: paymentError.message };
  if (!payment) return { ok: false, status: 404, error: "Payment record not found." };
  if (!payment.member_id) return { ok: false, status: 400, error: "Payment is not linked to a member." };

  const member = relatedMember(payment);
  const memberName = member?.full_name ?? "Member";
  const phone = normalizeWhatsAppPhone(member?.phone || "");
  const paymentType = labelize(payment.transaction_type);
  const amount = currency.format(Number(payment.amount));
  const receipt = payment.reference_number || payment.id.slice(0, 8).toUpperCase();
  const message = `Dear ${memberName}, Hamburg Ghana SDA Church confirms receipt of your ${paymentType} of ${amount} on ${payment.transaction_date}. Receipt No: ${receipt}. God bless you.`;

  if (!phone || phone.length < 8) {
    await admin.from("whatsapp_payment_notification_logs").upsert({
      member_id: payment.member_id,
      payment_id: payment.id,
      phone_number: phone || "missing",
      message,
      status: "failed",
      error_message: "Member does not have a valid WhatsApp number.",
    }, { onConflict: "payment_id" });
    return { ok: false, status: 400, error: "Member does not have a valid WhatsApp number." };
  }

  const { data: settings } = await admin.from("whatsapp_payment_settings").select("*").eq("id", true).maybeSingle<Settings>();
  const token = settings?.access_token || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = settings?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = settings?.default_template_name || process.env.WHATSAPP_PAYMENT_TEMPLATE_NAME || "";
  const language = settings?.template_language || process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
  const autoEnabled = settings?.auto_notifications_enabled ?? process.env.WHATSAPP_PAYMENT_AUTO_NOTIFICATIONS === "true";

  if (!options.retry && !autoEnabled) {
    await admin.from("whatsapp_payment_notification_logs").upsert({
      member_id: payment.member_id,
      payment_id: payment.id,
      phone_number: phone,
      message,
      status: "pending",
      error_message: "Automatic WhatsApp payment notifications are disabled.",
    }, { onConflict: "payment_id" });
    return { ok: true, status: 202, skipped: true, logStatus: "pending" };
  }

  await admin.from("whatsapp_payment_notification_logs").upsert({
    member_id: payment.member_id,
    payment_id: payment.id,
    phone_number: phone,
    message,
    status: "pending",
    error_message: null,
  }, { onConflict: "payment_id" });

  if (!token || !phoneNumberId) {
    await admin.from("whatsapp_payment_notification_logs").update({
      status: "failed",
      error_message: "WhatsApp integration not configured yet.",
    }).eq("payment_id", payment.id);
    return { ok: false, status: 200, notConfigured: true, error: "WhatsApp integration not configured yet." };
  }

  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
  const apiBaseUrl = process.env.WHATSAPP_GRAPH_API_BASE_URL || "https://graph.facebook.com";
  const body = templateName
    ? {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: [{
          type: "body",
          parameters: [memberName, paymentType, amount, payment.transaction_date, receipt].map((text) => ({ type: "text", text })),
        }],
      },
    }
    : { messaging_product: "whatsapp", to: phone, type: "text", text: { preview_url: false, body: message } };

  try {
    const response = await fetch(`${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "WhatsApp API request failed.");
    await admin.from("whatsapp_payment_notification_logs").update({
      status: "sent",
      provider_message_id: result.messages?.[0]?.id ?? null,
      error_message: null,
      sent_at: new Date().toISOString(),
    }).eq("payment_id", payment.id);
    return { ok: true, status: 200, logStatus: "sent" };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "WhatsApp API request failed.";
    await admin.from("whatsapp_payment_notification_logs").update({
      status: "failed",
      error_message: messageText,
    }).eq("payment_id", payment.id);
    return { ok: false, status: 502, error: messageText };
  }
}
