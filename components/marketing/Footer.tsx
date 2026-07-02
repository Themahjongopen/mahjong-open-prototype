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

const helloLinks = [
  { label: "Contact Us", href: "/contact" },
  { label: "Instagram", href: "#" },
  { label: "Privacy Policy", href: "#" },
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
                width={123}
                height={40}
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

          {/* Say hello */}
          <FooterCol title="Say hello" links={helloLinks} />
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
          <p style={{ fontSize: 13, color: "rgba(234,242,242,0.45)" }}>
            © 2026 The Mahjong Open
          </p>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacy", "Terms"].map((t) => (
              <Link
                key={t}
                href="#"
                style={{ fontSize: 13, color: "rgba(234,242,242,0.45)", textDecoration: "none" }}
              >
                {t}
              </Link>
            ))}
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
