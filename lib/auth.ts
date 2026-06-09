export const APP_ROLES = [
  "super_admin",
  "pastor",
  "elder",
  "church_clerk",
  "secretary",
  "treasurer",
  "department_head",
  "member",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  pastor: "Pastor",
  elder: "Elder",
  church_clerk: "Church Clerk",
  secretary: "Secretary",
  treasurer: "Treasurer",
  department_head: "Department Head",
  member: "Member",
};

const rolePriority = new Map(APP_ROLES.map((role, index) => [role, index]));

const allRoles = [...APP_ROLES];

const LEGACY_ROLE_MAP: Record<string, AppRole> = {
  admin: "super_admin",
  secretary: "secretary",
  elder: "elder",
  pastor: "pastor",
  treasurer: "treasurer",
  department_head: "department_head",
  member: "member",
  super_admin: "super_admin",
  church_clerk: "church_clerk",
};

export const ROUTE_ROLES: Record<string, AppRole[]> = {
  "/dashboard": allRoles,
  "/members": ["super_admin", "pastor", "elder", "church_clerk", "secretary", "department_head"],
  "/my-profile": allRoles,
  "/my-attendance": allRoles,
  "/my-contributions": allRoles,
  "/departments": ["super_admin", "pastor", "elder", "church_clerk", "secretary", "department_head"],
  "/attendance": ["super_admin", "pastor", "elder", "church_clerk", "secretary", "department_head"],
  "/operations": ["super_admin", "pastor", "elder", "church_clerk", "secretary"],
  "/baptism-transfers": ["super_admin", "pastor", "elder", "church_clerk", "secretary", "department_head"],
  "/contributions": allRoles,
  "/offerings": ["super_admin", "pastor", "elder", "treasurer"],
  "/giving": allRoles,
  "/giving-history": ["super_admin", "treasurer"],
  "/events": allRoles,
  "/announcements": allRoles,
  "/communications": ["super_admin", "pastor", "elder", "secretary"],
  "/prayer-requests": allRoles,
  "/sermons": allRoles,
  "/livestream": allRoles,
  "/whatsapp": ["super_admin", "pastor", "elder", "church_clerk", "secretary"],
  "/reports": ["super_admin", "pastor", "elder", "treasurer", "secretary"],
  "/advanced-modules": ["super_admin", "pastor", "elder"],
  "/settings": ["super_admin"],
  "/users": ["super_admin"],
  "/change-password": allRoles,
};

export function getAllowedRoles(pathname: string) {
  const route = Object.keys(ROUTE_ROLES).find((path) => pathname === path || pathname.startsWith(`${path}/`));
  return route ? ROUTE_ROLES[route] : null;
}

export function hasAllowedRole(userRoles: AppRole[], allowedRoles: AppRole[]) {
  return userRoles.includes("super_admin") || userRoles.some((role) => allowedRoles.includes(role));
}

export function orderRoles(userRoles: AppRole[]) {
  return [...new Set(userRoles)].sort((left, right) => (rolePriority.get(left) ?? 999) - (rolePriority.get(right) ?? 999));
}

export function getPrimaryRole(userRoles: AppRole[]) {
  return orderRoles(userRoles)[0] ?? "member";
}

export function toAppRole(value: string | null | undefined) {
  return value ? LEGACY_ROLE_MAP[value] ?? null : null;
}

export function normalizeRoles(values: (string | null | undefined)[]) {
  return orderRoles(values.map(toAppRole).filter((role): role is AppRole => Boolean(role)));
}

export function isSupabaseConfigured() {
  return getSupabaseConfigError() === null;
}

export function getSupabasePublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
}

export function getSupabaseConfigError() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabasePublicKey();

  if (!url || !key) return "Supabase environment variables are missing.";
  if (url.includes("your-project") || key === "your-anon-key") return "Supabase environment variables still contain placeholder values.";

  try {
    new URL(url);
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL is not a valid URL.";
  }

  return null;
}

export function getSafeRedirectPath(value: string | null, fallback = "/dashboard") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
