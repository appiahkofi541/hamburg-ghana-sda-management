export const APP_ROLES = [
  "admin",
  "pastor",
  "elder",
  "treasurer",
  "secretary",
  "department_head",
  "member",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  pastor: "Pastor",
  elder: "Elder",
  treasurer: "Treasurer",
  secretary: "Secretary",
  department_head: "Department Head",
  member: "Member",
};

const rolePriority = new Map(APP_ROLES.map((role, index) => [role, index]));

const allRoles = [...APP_ROLES];

export const ROUTE_ROLES: Record<string, AppRole[]> = {
  "/dashboard": allRoles,
  "/members": allRoles,
  "/my-profile": allRoles,
  "/my-attendance": allRoles,
  "/my-contributions": allRoles,
  "/departments": ["admin", "pastor", "elder", "secretary", "department_head"],
  "/attendance": ["admin", "pastor", "elder", "secretary", "department_head"],
  "/offerings": ["admin", "treasurer"],
  "/giving": allRoles,
  "/giving-history": allRoles,
  "/events": allRoles,
  "/announcements": allRoles,
  "/prayer-requests": allRoles,
  "/sermons": allRoles,
  "/livestream": allRoles,
  "/whatsapp": ["admin", "pastor", "secretary"],
  "/reports": ["admin", "pastor", "elder", "treasurer", "secretary"],
  "/advanced-modules": ["admin", "pastor"],
  "/settings": ["admin"],
  "/users": ["admin"],
  "/change-password": allRoles,
};

export function getAllowedRoles(pathname: string) {
  const route = Object.keys(ROUTE_ROLES).find((path) => pathname === path || pathname.startsWith(`${path}/`));
  return route ? ROUTE_ROLES[route] : null;
}

export function hasAllowedRole(userRoles: AppRole[], allowedRoles: AppRole[]) {
  return userRoles.some((role) => allowedRoles.includes(role));
}

export function orderRoles(userRoles: AppRole[]) {
  return [...new Set(userRoles)].sort((left, right) => rolePriority.get(left)! - rolePriority.get(right)!);
}

export function getPrimaryRole(userRoles: AppRole[]) {
  return orderRoles(userRoles)[0] ?? "member";
}

export function isSupabaseConfigured() {
  return getSupabaseConfigError() === null;
}

export function getSupabaseConfigError() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
