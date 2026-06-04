import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_ROLES, type AppRole } from "@/lib/auth";
import { requireAdmin, serviceRoleMissingMessage } from "../_shared";

function validRole(value: unknown): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json() as { email?: string; fullName?: string; role?: AppRole };
  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  if (!email || !fullName || !validRole(body.role)) {
    return NextResponse.json({ error: "Full name, email, and role are required to invite a user." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: serviceRoleMissingMessage() }, { status: 503 });
  }

  const redirectTo = `${new URL(request.url).origin}/auth/callback?next=/change-password`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || "Supabase could not create the invitation." }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    full_name: fullName,
    email,
    is_active: true,
  }, { onConflict: "id" });
  if (profileError) {
    return NextResponse.json({ error: `Invitation sent, but profile setup failed: ${profileError.message}` }, { status: 500 });
  }

  const { error: memberRoleDeleteError } = await admin.from("user_roles").delete().eq("user_id", data.user.id);
  if (memberRoleDeleteError) {
    return NextResponse.json({ error: `Invitation sent, but existing role cleanup failed: ${memberRoleDeleteError.message}` }, { status: 500 });
  }

  const { error: roleError } = await admin.from("user_roles").insert({ user_id: data.user.id, role: body.role });
  if (roleError) {
    return NextResponse.json({ error: `Invitation sent, but role assignment failed: ${roleError.message}` }, { status: 500 });
  }

  await admin.from("user_access_audit").insert({
    user_id: data.user.id,
    action: "invited",
    performed_by: auth.user.id,
    details: { email, role: body.role },
  });

  return NextResponse.json({ message: "Invitation sent successfully." });
}
