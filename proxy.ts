import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Coming-soon gate only fires on the live apex domain (www redirects to apex at
// the platform level). Vercel previews and localhost are never gated.
const GATED_HOSTS = new Set(["themahjongopen.com", "www.themahjongopen.com"]);
const PREVIEW_COOKIE = "cs_preview";

// Portal routes that must stay reachable without a session.
const PORTAL_PUBLIC_PATHS = [
  "/portal/login",
  "/portal/set-password",
  "/portal/reset-password",
  "/portal/update-password",
  "/portal/auth/callback",
];

// Paths that stay reachable even when the coming-soon gate is on.
function isComingSoonExempt(pathname: string) {
  return (
    pathname === "/coming-soon" ||
    pathname.startsWith("/coming-soon/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/admin") ||
    // Members reach the portal even while the marketing site is gated.
    pathname.startsWith("/portal") ||
    // Metadata image routes (extensionless): social crawlers must get the actual
    // image, not the teaser HTML, so share-link previews work while gated.
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image") ||
    // Any request for a file (has an extension) — lets root-level /public assets
    // (.jpg/.png/.svg/.webp/.ico/.xml/.txt/…) through instead of redirecting them
    // to the teaser HTML. (/_next and /assets are already excluded by the matcher.)
    /\.[^/]+$/.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // --- Coming-soon gate (OFF unless the COMING_SOON env var is set) ---
  if (process.env.COMING_SOON) {
    const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
    if (GATED_HOSTS.has(hostname) && !isComingSoonExempt(pathname)) {
      // Bypass requires the secret ?preview=<token> matching COMING_SOON_PREVIEW_TOKEN.
      // A valid token mints a cookie so the rest of the session is exempt; rotating
      // the env token invalidates old cookies. No token configured = no bypass.
      const token = process.env.COMING_SOON_PREVIEW_TOKEN;
      const cookieOk = !!token && request.cookies.get(PREVIEW_COOKIE)?.value === token;

      if (!cookieOk) {
        const previewParam = request.nextUrl.searchParams.get("preview");
        if (token && previewParam === token) {
          const cleanUrl = request.nextUrl.clone();
          cleanUrl.searchParams.delete("preview");
          const res = NextResponse.redirect(cleanUrl);
          res.cookies.set(PREVIEW_COOKIE, token, {
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30,
          });
          return res;
        }
        return NextResponse.redirect(new URL("/coming-soon", request.url));
      }
      // Valid preview cookie — fall through to the normal site.
    }
  }

  // --- Portal + admin session gating (Phase 2; passcode retired) ---
  const isPortal = pathname.startsWith("/portal");
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin/");

  if (isPortal || isAdminArea) {
    // Refresh the Supabase session and read the current user.
    const { response, user } = await updateSession(request);

    // Admins sign in through the portal; the admin role (profiles.role='admin')
    // is enforced in the admin layout and every admin API route.
    if (isAdminArea) {
      if (!user) {
        if (pathname.startsWith("/api/admin/")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL("/portal/login", request.url);
        loginUrl.searchParams.set("next", pathname + search);
        const redirect = NextResponse.redirect(loginUrl);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
      return response;
    }

    const isPublic = PORTAL_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!isPublic && !user) {
      const loginUrl = new URL("/portal/login", request.url);
      loginUrl.searchParams.set("next", pathname + search);
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
