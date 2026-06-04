import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json() as { fundId?: string; amount?: number; donorName?: string; donorEmail?: string; notes?: string };
  if (!body.fundId || !body.donorName?.trim() || !body.donorEmail?.trim() || !body.amount || body.amount <= 0) return NextResponse.json({ error: "Fund, donor details, and a positive amount are required." }, { status: 400 });
  const { data: payment, error } = await supabase.from("online_giving_payments").insert({ fund_id: body.fundId, amount: body.amount, donor_name: body.donorName.trim(), donor_email: body.donorEmail.trim(), notes: body.notes?.trim() || null }).select("id, receipt_number").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const secret = process.env.STRIPE_SECRET_KEY;
  const admin = createAdminClient();
  if (!secret || !admin) return NextResponse.json({ error: "Giving record created. Configure STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY on the server to enable Stripe Checkout.", paymentId: payment.id, receiptNumber: payment.receipt_number }, { status: 503 });
  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/giving/receipt/${payment.id}`,
    cancel_url: `${origin}/giving`,
    customer_email: body.donorEmail.trim(),
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][product_data][name]": "Hamburg Ghana SDA Church Online Giving",
    "line_items[0][price_data][unit_amount]": String(Math.round(body.amount * 100)),
    "line_items[0][quantity]": "1",
    "metadata[giving_id]": payment.id,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const session = await response.json();
  if (!response.ok || !session.url) return NextResponse.json({ error: session.error?.message || "Unable to start Stripe Checkout.", paymentId: payment.id }, { status: 502 });
  await admin.from("online_giving_payments").update({ provider_checkout_session_id: session.id }).eq("id", payment.id);
  return NextResponse.json({ checkoutUrl: session.url, paymentId: payment.id, receiptNumber: payment.receipt_number });
}
