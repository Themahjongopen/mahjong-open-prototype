"use client";

import { useState } from "react";
import Image from "next/image";
import { LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface PortalAppBarProps {
  title: string;
  userName?: string;
  // Admins get a "Switch to admin view" link that navigates to /admin.
  isAdminRole?: boolean;
}

export default function PortalAppBar({ title, userName, isAdminRole }: PortalAppBarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "P";

  return (
    <header className="portal-appbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Image src="/assets/mark-primary.svg" alt="" width={24} height={24} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--ink-900)" }}>{title}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Avatar */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setPopoverOpen(!popoverOpen)}
            aria-label="Account menu"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--pink-100)",
              border: "2px solid var(--pink-300)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--pink-700)",
              cursor: "pointer",
            }}
          >
            {initials}
          </button>

          {popoverOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "#fff",
                border: "1px solid var(--hair-200)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-md)",
                minWidth: 200,
                zIndex: 200,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair-200)" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>{userName || "Player"}</p>
                <p style={{ fontSize: 12, color: "var(--ink-500)" }}>Spring 2026 Season</p>
              </div>
              {isAdminRole && (
                <button
                  onClick={() => { setPopoverOpen(false); router.push("/admin"); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--ink-800)",
                    borderBottom: "1px solid var(--hair-200)",
                    textAlign: "left",
                  }}
                >
                  <ShieldCheck size={15} color="var(--peri-400)" />
                  Switch to admin view
                </button>
              )}
              <button
                onClick={handleSignOut}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--danger)",
                  textAlign: "left",
                }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {popoverOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => setPopoverOpen(false)} />
      )}
    </header>
  );
}
