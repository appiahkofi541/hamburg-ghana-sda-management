import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeRoles } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const announcementManagers = new Set(["super_admin", "pastor", "elder", "secretary"]);

function toIsoDateTime(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toEndOfDayIso(value: string | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError) return NextResponse.json({ error: `Unable to verify communication permissions: ${roleError.message}` }, { status: 400 });

  const roles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
  if (!roles.some((role) => announcementManagers.has(role))) {
    return NextResponse.json({ error: "Access denied. Only Super Admin, Pastor, Elder, or Secretary can create announcements." }, { status: 403 });
  }

  const body = await request.json() as {
    title?: string;
    body?: string;
    targetAudience?: string;
    departmentName?: string;
    scheduledAt?: string;
    expiresAt?: string;
  };

  const title = body.title?.trim();
  const message = body.body?.trim();
  const targetAudience = body.targetAudience ?? "all_members";
  if (!title || !message) return NextResponse.json({ error: "Announcement title and body are required." }, { status: 400 });
  if (!["all_members", "department", "leaders"].includes(targetAudience)) return NextResponse.json({ error: "Select a valid target audience." }, { status: 400 });

  const scheduledAt = toIsoDateTime(body.scheduledAt);
  const expiresAt = toEndOfDayIso(body.expiresAt);
  if (body.scheduledAt && !scheduledAt) return NextResponse.json({ error: "Schedule date is invalid." }, { status: 400 });
  if (body.expiresAt && !expiresAt) return NextResponse.json({ error: "Expiry date is invalid." }, { status: 400 });
  if (scheduledAt && expiresAt && new Date(expiresAt).getTime() < new Date(scheduledAt).getTime()) {
    return NextResponse.json({ error: "Expiry date must be after the scheduled publish date." }, { status: 400 });
  }

  const status = scheduledAt && new Date(scheduledAt).getTime() > Date.now() ? "scheduled" : "published";
  const writer = createAdminClient() ?? supabase;
  const { data, error } = await writer.from("communication_announcements").insert({
    title,
    body: message,
    target_audience: targetAudience,
    department_name: body.departmentName?.trim() || null,
    status,
    scheduled_at: scheduledAt,
    expires_at: expiresAt,
    created_by: user.id,
  }).select("*").single();

  if (error) {
    return NextResponse.json({ error: `Announcement was not saved: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ announcement: data, message: status === "published" ? "Announcement published successfully." : "Announcement scheduled successfully." });
}
