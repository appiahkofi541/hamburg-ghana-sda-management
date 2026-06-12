import type { SupabaseClient } from "@supabase/supabase-js";

export type ChurchProfile = {
  church_name: string;
  short_name: string;
  logo_url: string;
  address: string;
  city: string;
  country: string;
  postal_code: string;
  phone: string;
  email: string;
  website: string;
  pastor_name: string;
  pastor_phone: string;
  pastor_email: string;
  secretary_name: string;
  secretary_phone: string;
  secretary_email: string;
  treasurer_name: string;
  treasurer_phone: string;
  treasurer_email: string;
  sabbath_service_time: string;
  prayer_meeting_time: string;
  default_currency: string;
  default_language: string;
  social_facebook: string;
  social_youtube: string;
  social_instagram: string;
  social_tiktok: string;
  bank_name: string;
  iban: string;
  account_name: string;
  notes: string;
};

export type ChurchElder = {
  id: string;
  elder_name: string;
  elder_phone: string;
  elder_email: string;
  sort_order: number;
  is_active: boolean;
};

export const fallbackChurchProfile: ChurchProfile = {
  church_name: "Hamburg Ghana SDA Church",
  short_name: "Hamburg Ghana SDA",
  logo_url: "",
  address: "Hamburg",
  city: "Hamburg",
  country: "Germany",
  postal_code: "",
  phone: "",
  email: "",
  website: "https://hamburg-ghana-sda-management.vercel.app",
  pastor_name: "",
  pastor_phone: "",
  pastor_email: "",
  secretary_name: "",
  secretary_phone: "",
  secretary_email: "",
  treasurer_name: "",
  treasurer_phone: "",
  treasurer_email: "",
  sabbath_service_time: "Saturday 09:30",
  prayer_meeting_time: "Wednesday 19:00",
  default_currency: "EUR",
  default_language: "en",
  social_facebook: "",
  social_youtube: "",
  social_instagram: "",
  social_tiktok: "",
  bank_name: "",
  iban: "",
  account_name: "",
  notes: "",
};

export function normalizeChurchProfile(value: Partial<ChurchProfile> | null | undefined): ChurchProfile {
  return { ...fallbackChurchProfile, ...Object.fromEntries(Object.entries(value ?? {}).map(([key, item]) => [key, item ?? ""])) };
}

export function churchLocation(profile: Pick<ChurchProfile, "address" | "city" | "country" | "postal_code">) {
  return [profile.address, profile.postal_code, profile.city, profile.country].filter(Boolean).join(", ");
}

export async function loadPublicChurchProfile(supabase: SupabaseClient | null): Promise<ChurchProfile> {
  if (!supabase) return fallbackChurchProfile;
  const { data } = await supabase.rpc("get_public_church_profile");
  return normalizeChurchProfile(data as Partial<ChurchProfile> | null);
}

export function normalizeChurchElder(value: Partial<ChurchElder>): ChurchElder {
  return {
    id: value.id ?? "",
    elder_name: value.elder_name ?? "",
    elder_phone: value.elder_phone ?? "",
    elder_email: value.elder_email ?? "",
    sort_order: Number(value.sort_order ?? 0),
    is_active: value.is_active ?? true,
  };
}
