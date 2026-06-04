import { NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    if (!supabase) return NextResponse.redirect(`${origin}/login?error=supabase-not-configured`);
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } catch {
      return NextResponse.redirect(`${origin}/login?error=supabase-unavailable`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback`);
}
