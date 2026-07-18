"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Building2, CalendarRange, Users, Table2, ClipboardCheck, LogOut, ExternalLink, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Cities", href: "/admin/cities", icon: Building2 },
  { label: "Series", href: "/admin/series", icon: CalendarRange },
  { label: "Players", href: "/admin/players", icon: Users },
  { label: "Tables", href: "/admin/tables", icon: Table2 },
  { label: "Scores", href: "/admin/scores", icon: ClipboardCheck },
];

export default function AdminShell({ children, adminName }: { children: React.ReactNode; adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) {
      document.body.classList.remove("admin-drawer-open");
      return;
    }

    document.body.classList.add("admin-drawer-open");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("admin-drawer-open");
    };
  }, [drawerOpen]);

  function closeDrawer() {
    setDrawerOpen(false);
  }

  async function signOut() {
    closeDrawer();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="admin-shell">
      <div className={`admin-drawer-backdrop ${drawerOpen ? "is-open" : ""}`} onClick={closeDrawer} />

      <header className="admin-mobile-topbar">
        <button type="button" className="admin-mobile-nav-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open admin navigation" aria-expanded={drawerOpen}>
          <Menu size={20} />
        </button>
        <div className="admin-mobile-topbar-content">
          <div className="admin-mobile-topbar-brand">
            <Image src="/assets/mark-mono.svg" alt="" width={20} height={20} />
            <span>Mahjong Open</span>
          </div>
          <p>Admin</p>
        </div>
      </header>

      <aside className={`admin-sidebar ${drawerOpen ? "is-open" : ""}`}>
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-brand">
            <Image src="/assets/mark-mono.svg" alt="" width={24} height={24} />
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--fg-on-dark)" }}>Mahjong Open</span>
              <p style={{ fontSize: 11, color: "rgba(234,242,242,0.4)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>Admin Panel</p>
            </div>
          </div>
          <button type="button" className="admin-sidebar-close" onClick={closeDrawer} aria-label="Close admin navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={`admin-sidebar-link ${active ? "is-active" : ""}`} onClick={closeDrawer}>
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/portal" className="admin-sidebar-footer-link" onClick={closeDrawer}>
            <ExternalLink size={14} />
            Player portal
          </Link>
          <button type="button" onClick={signOut} className="admin-sidebar-footer-button">
            <LogOut size={14} />
            Sign out
          </button>
          <div className="admin-sidebar-user">
            <p>{adminName}</p>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-main-page">{children}</div>
      </main>
    </div>
  );
}
