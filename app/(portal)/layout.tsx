import { PortalShell } from "@/components/portal-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeRoles } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=supabase-not-configured");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) redirect("/login?error=supabase-unavailable");
  if (!user) redirect("/login");

  const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase.from("profiles").select("full_name, is_active").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (profileError || roleError) redirect("/login?error=supabase-unavailable");
  if (!profile?.is_active) redirect("/unauthorized");

  const roles = normalizeRoles((roleRows ?? []).map(({ role }) => role));
  if (!roles.length) redirect("/unauthorized");

  return (
    <PortalShell
      user={{
        name: profile?.full_name || user.email?.split("@")[0] || "Church User",
        email: user.email || "",
        roles,
      }}
    >
      {children}
    </PortalShell>
  );
}
