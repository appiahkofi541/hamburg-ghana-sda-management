import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAllowedRoles, hasAllowedRole, isSupabaseConfigured, orderRoles, type AppRole } from "@/lib/auth";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const allowedRoles = getAllowedRoles(request.nextUrl.pathname);

  if (!allowedRoles) return response;

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=supabase-not-configured", request.url));
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  let user;
  try {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError && userError.name !== "AuthSessionMissingError") {
      return NextResponse.redirect(new URL("/login?error=supabase-unavailable", request.url));
    }
    user = data.user;
  } catch {
    return NextResponse.redirect(new URL("/login?error=supabase-unavailable", request.url));
  }
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  let data;
  try {
    const [roleResult, profileResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle(),
    ]);
    if (roleResult.error || profileResult.error) {
      return NextResponse.redirect(new URL("/login?error=supabase-unavailable", request.url));
    }
    if (!profileResult.data?.is_active) return NextResponse.redirect(new URL("/unauthorized", request.url));
    data = roleResult.data;
  } catch {
    return NextResponse.redirect(new URL("/login?error=supabase-unavailable", request.url));
  }
  const roles = orderRoles((data ?? []).map(({ role }) => role as AppRole));

  if (!hasAllowedRole(roles, allowedRoles)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return response;
}
