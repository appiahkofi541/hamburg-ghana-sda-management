import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function validSignature(body: string, signature: string, secret: string) {
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=")));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${body}`).digest("hex");
  const left = Buffer.from(expected); const right = Buffer.from(parts.v1);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || !admin) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("stripe-signature") || "", secret)) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  const event = JSON.parse(rawBody);
  const { data: known } = await admin.from("payment_webhook_events").select("id").eq("id", event.id).maybeSingle();
  if (known) return NextResponse.json({ received: true });
  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
    const session = event.data.object;
    const givingId = session.metadata?.giving_id;
    const { data: giving } = await admin.from("online_giving_payments").select("*").eq("id", givingId).eq("status", "pending").maybeSingle();
    if (giving) {
      const { data: contribution } = await admin.from("contributions").insert({ fund_id: giving.fund_id, amount: giving.amount, contribution_date: new Date().toISOString().slice(0, 10), payment_method: "card", receipt_number: giving.receipt_number, source_name: giving.donor_name, notes: giving.notes, recorded_by: giving.donor_id }).select("id").single();
      await admin.from("online_giving_payments").update({ status: "completed", provider_checkout_session_id: session.id, provider_payment_intent_id: session.payment_intent, contribution_id: contribution?.id ?? null, completed_at: new Date().toISOString() }).eq("id", giving.id);
    }
  }
  await admin.from("payment_webhook_events").insert({ id: event.id, event_type: event.type });
  return NextResponse.json({ received: true });
}
