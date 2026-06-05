import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicKey, isSupabaseConfigured } from "@/lib/auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = getSupabasePublicKey();

let client: SupabaseClient | null = null;

export function createClient() {
  if (!url || !key || !isSupabaseConfigured()) return null;
  if (!client) client = createBrowserClient(url, key);
  return client;
}
