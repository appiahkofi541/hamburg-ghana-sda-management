import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPaymentWhatsAppReceipt } from "@/lib/whatsapp/payment-receipts";

async function requireTreasurer() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some(({ role }) => role === "treasurer")) return { error: NextResponse.json({ error: "Only Treasurer can send payment WhatsApp notifications." }, { status: 403 }) };
  return {};
}

export async function POST(request: Request) {
  const auth = await requireTreasurer();
  if (auth.error) return auth.error;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required for server-side WhatsApp notification logs." }, { status: 503 });
  const { paymentId, retry = false } = await request.json() as { paymentId?: string; retry?: boolean };
  if (!paymentId) return NextResponse.json({ error: "Payment ID is required." }, { status: 400 });
  const result = await sendPaymentWhatsAppReceipt(admin, paymentId, { retry });
  return NextResponse.json(result, { status: result.status });
}
