import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/admin/passcode";
import { updateSession } from "@/lib/supabase/proxy";

// Portal routes that must stay reachable without a session.
const PORTAL_PUBLIC_PATHS = [
  "/portal/login",
  "/portal/set-password",
  "/portal/reset-password",
  "/portal/update-password",
  "/portal/auth/callback",
];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // --- Admin passcode gate (unchanged from Phase 1) ---
  const isAdminLoginPage = pathname === "/admin/login";
  const isAdminLoginRoute = pathname === "/api/admin/login";
  if (!isAdminLoginPage && !isAdminLoginRoute) {
    const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin/");
    if (isAdminArea) {
      const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
      if (!isValidAdminCookie(cookieValue, process.env.ADMIN_PASSCODE)) {
        if (pathname.startsWith("/api/admin/")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // --- Portal auth gate (Phase 2) ---
  if (pathname.startsWith("/portal")) {
    // Refresh the Supabase session and read the current user.
    const { response, user } = await updateSession(request);

    const isPublic = PORTAL_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!isPublic && !user) {
      const loginUrl = new URL("/portal/login", request.url);
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
      const redirect = NextResponse.redirect(loginUrl);
      // Preserve any refreshed auth cookies on the redirect.
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets|images).*)",
  ],
};
