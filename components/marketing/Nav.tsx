"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Contact", href: "/contact" },
  { label: "Shop Our Favorites", href: "/shop" },
];

interface NavProps {
  activePage?: string;
  onRegisterClick?: () => void;
}

export default function Nav({ activePage, onRegisterClick }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 64,
          display: "flex",
          alignItems: "center",
          backgroundColor: scrolled ? "rgba(250,252,251,0.88)" : "rgba(250,252,251,0.96)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: scrolled ? "1px solid var(--hair-200)" : "1px solid transparent",
          boxShadow: scrolled ? "var(--shadow-sm)" : "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        <div
          className="container-mo"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
        >
          {/* Brand */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <Image
              src="/assets/logo-nav.svg?v=2"
              alt="The Mahjong Open"
              width={123}
              height={40}
              priority
            />
          </Link>

          {/* Desktop links */}
          <nav
            style={{ display: "flex", alignItems: "center", gap: 28 }}
            className="hidden-mobile"
            aria-label="Main navigation"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: 14,
                  fontWeight: activePage === link.href ? 600 : 400,
                  color: activePage === link.href ? "var(--pink-600)" : "var(--ink-900)",
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }} className="hidden-mobile">
            <Link
              href="/portal/login"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--pink-600)",
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
            <button className="btn btn-primary" style={{ fontSize: 14, padding: "9px 20px" }} onClick={onRegisterClick}>
              Register
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="show-mobile"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--ink-900)" }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            top: 64,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--paper-50)",
            zIndex: 99,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                fontSize: 18,
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                color: activePage === link.href ? "var(--pink-600)" : "var(--ink-900)",
                textDecoration: "none",
                padding: "12px 0",
                borderBottom: "1px solid var(--hair-200)",
              }}
            >
              {link.label}
            </Link>
          ))}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              href="/portal/login"
              onClick={() => setMobileOpen(false)}
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--pink-600)",
                textDecoration: "none",
                textAlign: "center",
                padding: "10px",
              }}
            >
              Sign In
            </Link>
            <button
              className="btn btn-primary"
              style={{ fontSize: 15, padding: "12px 24px" }}
              onClick={() => {
                setMobileOpen(false);
                onRegisterClick?.();
              }}
            >
              Register
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 900px) {
          .hidden-mobile { display: flex !important; }
          .show-mobile { display: none !important; }
        }
        @media (max-width: 899px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
      `}</style>
    </>
  );
}
