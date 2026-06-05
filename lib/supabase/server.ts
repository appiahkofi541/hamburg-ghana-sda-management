import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicKey, isSupabaseConfigured } from "@/lib/auth";

export async function createClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = getSupabasePublicKey()!;

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Middleware refreshes sessions when Server Components cannot write cookies.
          }
        },
      },
    },
  );
}
