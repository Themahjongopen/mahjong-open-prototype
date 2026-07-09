import Link from "next/link";
import Image from "next/image";

const leagueLinks = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Contact", href: "/contact" },
  { label: "Shop Our Favorites", href: "/shop" },
];

const memberLinks = [
  { label: "Sign In", href: "/login" },
  { label: "Player Portal", href: "/portal" },
  { label: "Register", href: "#register" },
];

const policyLinks = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Disclaimer", href: "/disclaimer" },
];

export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--ink-900)",
        color: "var(--fg-on-dark)",
        padding: "64px 0 32px",
      }}
    >
      <div className="container-mo">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
            gap: 48,
            marginBottom: 48,
          }}
          className="footer-grid"
        >
          {/* Brand column */}
          <div>
            <div style={{ marginBottom: 16 }}>
              <Image
                src="/assets/logo-white.svg?v=2"
                alt="The Mahjong Open"
                width={140}
                height={45}
              />
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(234,242,242,0.6)", maxWidth: 220 }}>
              A city-based mahjong social league for everyone who loves the game. One series, eight weeks, endless tables.
            </p>
          </div>

          {/* League */}
          <FooterCol title="League" links={leagueLinks} />

          {/* Members */}
          <FooterCol title="Members" links={memberLinks} />

          {/* Policies */}
          <FooterCol title="Policies" links={policyLinks} />
        </div>

        {/* Legal */}
        <div
          style={{
            borderTop: "1px solid rgba(234,242,242,0.12)",
            paddingTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, color: "var(--pink-100)", margin: 0 }}>
              © 2026 The Mahjong Open
            </p>
            <span style={{ color: "var(--pink-100)" }}>·</span>
            <a
              href="https://www.jordanpaulco.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: "var(--pink-100)", textDecoration: "none" }}
            >
              Site designed by Jordan Paul Co
            </a>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <a href="https://www.instagram.com/themahjongopen/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={{ color: "var(--pink-100)", display: "inline-flex" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a href="https://www.facebook.com/themahjongopen/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" style={{ color: "var(--pink-100)", display: "inline-flex" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 600px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(234,242,242,0.45)",
          marginBottom: 16,
        }}
      >
        {title}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              style={{
                fontSize: 14,
                color: "rgba(234,242,242,0.7)",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
