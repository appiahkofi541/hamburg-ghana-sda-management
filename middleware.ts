import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/members/:path*",
    "/visitors/:path*",
    "/departments/:path*",
    "/attendance/:path*",
    "/offerings/:path*",
    "/giving/:path*",
    "/events/:path*",
    "/announcements/:path*",
    "/prayer-requests/:path*",
    "/sermons/:path*",
    "/livestream/:path*",
    "/whatsapp/:path*",
    "/assets/:path*",
    "/reports/:path*",
    "/advanced-modules/:path*",
    "/settings/:path*",
    "/users/:path*",
    "/change-password/:path*",
  ],
};
