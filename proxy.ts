import { NextResponse, type NextRequest } from "next/server";
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

  const isPortal = pathname.startsWith("/portal");
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin/");

  if (isPortal || isAdminArea) {
    // Refresh the Supabase session and read the current user.
    const { response, user } = await updateSession(request);

    // --- Admin gate (Phase 2) ---
    // The passcode is retired: admins sign in through the portal. Here we only
    // require an authenticated session; the admin role (profiles.role='admin')
    // is enforced in the admin layout and every admin API route.
    if (isAdminArea) {
      if (!user) {
        if (pathname.startsWith("/api/admin/")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL("/portal/login", request.url);
        loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
        const redirect = NextResponse.redirect(loginUrl);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
      return response;
    }

    // --- Portal auth gate (Phase 2) ---
    const isPublic = PORTAL_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!isPublic && !user) {
      const loginUrl = new URL("/portal/login", request.url);
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
      const redirect = NextResponse.redirect(loginUrl);
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
