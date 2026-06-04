import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const [{ data: role }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
    supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle(),
  ]);
  if (!role || !profile?.is_active) return { error: NextResponse.json({ error: "Active Admin access is required." }, { status: 403 }) };
  return { supabase, user };
}

export function serviceRoleMissingMessage() {
  return "SUPABASE_SERVICE_ROLE_KEY is missing on the server. Add SUPABASE_SERVICE_ROLE_KEY=your-service-role-key to .env.local, save the file, then restart the preview server. Do not prefix it with NEXT_PUBLIC_.";
}
