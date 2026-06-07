import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toAppRole } from "@/lib/auth";

const allowedRoles = new Set(["super_admin", "treasurer"]);

async function requireFinanceRole() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some(({ role }) => {
    const appRole = toAppRole(role);
    return appRole ? allowedRoles.has(appRole) : false;
  })) return { error: NextResponse.json({ error: "Only Super Admin and Treasurer can manage WhatsApp payment settings." }, { status: 403 }) };
  return { userId: user.id };
}

export async function GET() {
  const auth = await requireFinanceRole();
  if (auth.error) return auth.error;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({
    settings: null,
    notConfigured: true,
    message: "WhatsApp integration not configured yet.",
  });
  const { data, error } = await admin.from("whatsapp_payment_settings").select("phone_number_id, access_token, default_template_name, template_language, auto_notifications_enabled, updated_at").eq("id", true).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    settings: data ? {
      phone_number_id: data.phone_number_id,
      default_template_name: data.default_template_name,
      template_language: data.template_language,
      auto_notifications_enabled: data.auto_notifications_enabled,
      updated_at: data.updated_at,
      access_token_configured: Boolean(data.access_token),
    } : null,
  });
}

export async function POST(request: Request) {
  const auth = await requireFinanceRole();
  if (auth.error) return auth.error;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "WhatsApp integration not configured yet." }, { status: 503 });
  const body = await request.json() as {
    phoneNumberId?: string;
    accessToken?: string;
    defaultTemplateName?: string;
    templateLanguage?: string;
    autoNotificationsEnabled?: boolean;
  };
  const payload: Record<string, unknown> = {
    id: true,
    phone_number_id: body.phoneNumberId?.trim() || null,
    default_template_name: body.defaultTemplateName?.trim() || null,
    template_language: body.templateLanguage?.trim() || "en",
    auto_notifications_enabled: Boolean(body.autoNotificationsEnabled),
    updated_by: auth.userId,
  };
  if (body.accessToken?.trim()) payload.access_token = body.accessToken.trim();
  const { error } = await admin.from("whatsapp_payment_settings").upsert(payload, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
