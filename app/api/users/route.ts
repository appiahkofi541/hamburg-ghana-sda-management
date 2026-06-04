import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_ROLES, type AppRole } from "@/lib/auth";
import { requireAdmin } from "./_shared";

function validRole(value: unknown): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("profiles").select("id, full_name, email, is_active, created_at, user_roles(role)").order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data, capabilities: { invitationsConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await request.json() as { action?: "role" | "deactivate" | "reset_password"; userId?: string; email?: string; role?: AppRole };
  if (!body.userId || !body.action) return NextResponse.json({ error: "User and action are required." }, { status: 400 });
  if ((body.action === "role" || body.action === "deactivate") && body.userId === auth.user.id) return NextResponse.json({ error: "You cannot change or deactivate your own admin access." }, { status: 400 });

  if (body.action === "role") {
    if (!validRole(body.role)) return NextResponse.json({ error: "Select a valid role." }, { status: 400 });
    const { error: roleError } = await auth.supabase.rpc("admin_set_user_role", { target_user_id: body.userId, new_role: body.role });
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 400 });
    await auth.supabase.from("user_access_audit").insert({ user_id: body.userId, action: "role_changed", details: { role: body.role } });
    return NextResponse.json({ message: "User role updated successfully." });
  }

  if (body.action === "deactivate") {
    const { error } = await auth.supabase.from("profiles").update({ is_active: false }).eq("id", body.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const admin = createAdminClient();
    if (admin) await admin.auth.admin.updateUserById(body.userId, { ban_duration: "876000h" });
    await auth.supabase.from("user_access_audit").insert({ user_id: body.userId, action: "deactivated" });
    return NextResponse.json({ message: "User deactivated successfully." });
  }

  if (!body.email?.trim()) return NextResponse.json({ error: "User email is required." }, { status: 400 });
  const redirectTo = `${new URL(request.url).origin}/auth/callback?next=/change-password`;
  const { error } = await auth.supabase.auth.resetPasswordForEmail(body.email.trim(), { redirectTo });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auth.supabase.from("user_access_audit").insert({ user_id: body.userId, action: "password_reset_requested" });
  return NextResponse.json({ message: "Password reset link sent successfully." });
}
