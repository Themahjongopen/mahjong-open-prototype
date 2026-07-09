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
    pathname.startsWith("/admin")
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
      const hasPreviewParam = request.nextUrl.searchParams.has("preview");
      const hasPreviewCookie = request.cookies.get(PREVIEW_COOKIE)?.value === "1";

      if (!hasPreviewParam && !hasPreviewCookie) {
        return NextResponse.redirect(new URL("/coming-soon", request.url));
      }
      // First visit with ?preview= — remember it for the rest of the session.
      if (hasPreviewParam && !hasPreviewCookie) {
        const res = NextResponse.next();
        res.cookies.set(PREVIEW_COOKIE, "1", { path: "/", sameSite: "lax" });
        return res;
      }
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
