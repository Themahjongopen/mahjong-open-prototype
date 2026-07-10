import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/admin/passcode";

// Coming-soon gate only fires on the live apex domain (www redirects to apex at
// the platform level). Vercel previews and localhost are never gated.
const GATED_HOSTS = new Set(["themahjongopen.com", "www.themahjongopen.com"]);
const PREVIEW_COOKIE = "cs_preview";

// Paths that stay reachable even when the coming-soon gate is on.
function isComingSoonExempt(pathname: string) {
  return (
    pathname === "/coming-soon" ||
    pathname.startsWith("/coming-soon/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/admin") ||
    // Any request for a file (has an extension) — lets root-level /public assets
    // (.jpg/.png/.svg/.webp/.ico/.xml/.txt/…) through instead of redirecting them
    // to the teaser HTML. (/_next and /assets are already excluded by the matcher.)
    /\.[^/]+$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // --- Retire the exposed prototype surfaces on main (always on) ---
  // The demo /login picker and the mock /portal are not for the public site.
  if (pathname === "/login" || pathname === "/portal" || pathname.startsWith("/portal/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

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
          // Grant access: set the cookie and strip the token from the URL.
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

  // --- Admin passcode gate (unchanged) ---
  const isAdminLoginPage = pathname === "/admin/login";
  const isAdminLoginRoute = pathname === "/api/admin/login";
  if (!isAdminLoginPage && !isAdminLoginRoute) {
    const isAdminApi = pathname.startsWith("/api/admin/");
    const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!isValidAdminCookie(cookieValue, process.env.ADMIN_PASSCODE)) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (pathname.startsWith("/admin")) {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("next", pathname + search);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets|images).*)",
  ],
};
