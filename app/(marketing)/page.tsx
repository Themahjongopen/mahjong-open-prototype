"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RegisterModal from "@/components/marketing/RegisterModal";
import CommissionerSection from "@/components/marketing/CommissionerSection";
import { Users, CalendarDays, Repeat2, Trophy, MapPin, Shuffle, Sparkles } from "lucide-react";

const FORMAT_STEPS = [
  {
    icon: Users,
    title: "Register for your city",
    body: "Join the series in your city. One registration covers your full 8-week League.",
  },
  {
    icon: CalendarDays,
    title: "Sign up each week",
    body: "Every week, claim a spot at an open table — or create your own. Any paid player in your city can host.",
  },
  {
    icon: Shuffle,
    title: "Play with new people",
    body: "Tables are open across skill levels. Mix it up, meet your city's players, keep it fresh.",
  },
  {
    icon: Trophy,
    title: "Track your average score",
    body: "Scores are self-reported after each game. Standings reflect average score over the full series.",
  },
  {
    icon: Repeat2,
    title: "Climb the standings",
    body: "Track your rank on the city leaderboard. The series finale celebrates your city's top players.",
  },
  {
    icon: MapPin,
    title: "Play anywhere",
    body: "Tables happen wherever players want — homes, cafés, clubs. You choose the spot each week.",
  },
];

const SERIES_SCHEDULE = [
  {
    name: "Series One",
    year: "2026",
    dates: "Aug 17 – Oct 11, 2026",
    body: "The inaugural 8-week series. Register, join tables across your city, and set the pace on the leaderboard.",
  },
  {
    name: "Series Two",
    year: "2026",
    dates: "Nov 2 – Dec 27, 2026",
    body: "After a short break, the second 8-week series runs through the season. Registration opens as Series One wraps.",
  },
];

const WHY_LOVE = [
  {
    icon: CalendarDays,
    title: "Play on your schedule",
    body: "Unlimited games across the 8-week series. Join an open table or host your own, whenever it suits you.",
  },
  {
    icon: Users,
    title: "Meet your city",
    body: "Every series brings your local players together — new tables, new faces, and a community that lasts.",
  },
  {
    icon: Sparkles,
    title: "All skill levels welcome",
    body: "New to mahjong or a longtime player, you belong here. Tables are open across every skill level.",
  },
];

const FAQS = [
  {
    q: "What is The Mahjong Open?",
    a: "A city-based mahjong social league. You register once and play unlimited games over an 8-week series, then climb your city's leaderboard.",
  },
  {
    q: "How much does it cost?",
    a: "$80 per 8-week series.",
  },
  {
    q: "How long is a series?",
    a: "Eight weeks, with five series a year.",
  },
  {
    q: "Do I need a partner or experience?",
    a: "No. A table seats four players, and all skill levels are welcome.",
  },
  {
    q: "How do standings work?",
    a: "Scores are self-reported after each game, and standings rank by your average score across the series.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [formatVisible, setFormatVisible] = useState(false);
  const formatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = formatRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setFormatVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Hero */}
      <section style={{ padding: "72px 0 80px", background: "var(--bg)" }}>
        <div className="container-mo">
          <div className="hero-grid">
            {/* Copy */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
              <p className="eyebrow">The Mahjong Open</p>
              <h1 className="h1">
                A city-based mahjong<br />
                <em className="serif-italic">social league</em>
              </h1>
              <p className="body-lg" style={{ maxWidth: 480 }}>
                Register once, play unlimited games over an 8-week series, and climb your city&rsquo;s leaderboard.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setModalOpen(true)}
                  style={{ fontSize: 15 }}
                >
                  Save my spot →
                </button>
                <Link href="/how-it-works" className="btn btn-ghost" style={{ fontSize: 15 }}>
                  See how it works
                </Link>
              </div>
              {/* Stats */}
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap", paddingTop: 8 }}>
                {[
                  { num: "8", label: "Weeks per series" },
                  { num: "5", label: "Series a year" },
                  { num: "$80", label: "Per series" },
                ].map((s) => (
                  <div key={s.label} style={{ marginLeft: s.label === "Per series" ? 16 : 0 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 32,
                        fontWeight: 400,
                        color: "var(--pink-700)",
                        lineHeight: 1,
                        marginBottom: 4,
                      }}
                    >
                      {s.num}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--ink-500)" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Art */}
            <div style={{ position: "relative" }}>
              <div
                className="hero-media"
                style={{
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  background: "var(--pink-100)",
                  boxShadow: "var(--shadow-lg)",
                  position: "relative",
                }}
              >
                <Image
                  src="/assets/hero.jpg"
                  alt="Friends playing mahjong together around a table"
                  fill
                  style={{ objectFit: "cover", objectPosition: "center" }}
                  priority
                  sizes="(max-width: 900px) 100vw, 50vw"
                />
                {/* Fallback shown until /assets/hero.jpg is added */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, var(--pink-100) 0%, var(--pink-wash) 100%)",
                    zIndex: -1,
                  }}
                >
                  <Image src="/assets/mark-primary.svg" alt="" width={64} height={64} style={{ opacity: 0.3 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Format — How the league works */}
      <section style={{ padding: "72px 0", background: "var(--lime-wash)" }}>
        <div className="container-mo">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>How it works</p>
            <h2 className="h2">The league,{" "}<em className="serif-italic">explained</em></h2>
          </div>
          <div className={`format-grid ${formatVisible ? "in-view" : ""}`} ref={formatRef}>
            {FORMAT_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="format-card"
                  style={{
                    animationDelay: `${i * 0.09}s`,
                    background: "#fff",
                    border: "1px solid var(--hair-200)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow-sm)",
                    padding: "30px 28px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "var(--radius-md)",
                      background: "var(--pink-50)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={22} color="var(--pink-600)" />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                        fontWeight: 400,
                        color: "var(--ink-900)",
                        marginBottom: 8,
                        lineHeight: 1.2,
                      }}
                    >
                      {step.title}
                    </h3>
                    <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6 }}>{step.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <CommissionerSection />

      {/* Series schedule */}
      <section style={{ padding: "72px 0", background: "var(--pink-wash)" }}>
        <div className="container-mo">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Series schedule</p>
            <h2 className="h2">The 2026 <em className="serif-italic">series schedule</em></h2>
            <p className="body-lg" style={{ marginTop: 16, maxWidth: 560, marginInline: "auto" }}>
              Each series runs eight weeks of open play. Here are the first two series of 2026 &mdash; register once and you&rsquo;re set for the whole run.
            </p>
          </div>
          <div className="schedule-grid">
            {SERIES_SCHEDULE.map((s) => (
              <div
                key={s.name}
                className="card-lift"
                style={{
                  background: "#fff",
                  border: "1px solid var(--hair-200)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-sm)",
                  padding: "28px 28px",
                }}
              >
                <p className="eyebrow" style={{ marginBottom: 10 }}>{s.name} · {s.year}</p>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 26,
                    fontWeight: 400,
                    color: "var(--ink-900)",
                    lineHeight: 1.15,
                    marginBottom: 12,
                  }}
                >
                  {s.dates}
                </p>
                <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why you'll love it */}
      <section style={{ padding: "80px 0", background: "var(--peri-50)" }}>
        <div className="container-mo">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Come as you are</p>
            <h2 className="h2">Why you&rsquo;ll{" "}<em className="serif-italic">love it</em></h2>
          </div>
          <div className="format-grid">
            {WHY_LOVE.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 16,
                    padding: "8px 16px",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "var(--pink-50)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={24} color="var(--pink-600)" />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                        fontWeight: 400,
                        color: "var(--ink-900)",
                        marginBottom: 8,
                        lineHeight: 1.2,
                      }}
                    >
                      {item.title}
                    </h3>
                    <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6 }}>{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "72px 0", background: "var(--bg)" }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <div className="container-mo" style={{ maxWidth: 760 }}>
          <h2 className="h2" style={{ marginBottom: 32 }}>
            Your Mahjong Open Questions,{" "}
            <em className="serif-italic">Answered</em>
          </h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {FAQS.map((f, i) => (
              <div
                key={f.q}
                style={{
                  padding: "24px 0",
                  borderTop: "1px solid var(--hair-200)",
                  borderBottom: i === FAQS.length - 1 ? "1px solid var(--hair-200)" : undefined,
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 20,
                    fontWeight: 400,
                    color: "var(--ink-900)",
                    marginBottom: 8,
                  }}
                >
                  {f.q}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-700)", maxWidth: 620 }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Register CTA */}
      <section style={{ padding: "72px 0" }}>
        <div className="container-mo">
          <div
            style={{
              background: "linear-gradient(135deg, var(--pink-600) 0%, var(--pink-400) 100%)",
              borderRadius: "var(--radius-xl)",
              padding: "56px 48px",
              display: "flex",
              alignItems: "center",
              gap: 40,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 280 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(234,242,242,0.65)",
                  marginBottom: 16,
                }}
              >
                Launching August 2026
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px, 3.5vw, 38px)",
                  fontWeight: 400,
                  color: "#fff",
                  lineHeight: 1.1,
                  marginBottom: 16,
                }}
              >
                Ready to play?{" "}
                <em style={{ color: "var(--lime-200)" }}>Save your spot.</em>
              </h2>
              <p style={{ fontSize: 15, color: "rgba(234,242,242,0.8)", lineHeight: 1.6 }}>
                Registration includes your full 8-week series, access to all city tables, and a spot on the leaderboard.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 260 }}>
              {/* Glass box */}
              <div
                style={{
                  background: "rgba(255,255,255,0.14)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px 24px",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Your series includes:</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "8 weekly game nights",
                    "Access to all open tables in your city",
                    "Live standings & score tracking",
                    "Series schedule & event highlights",
                  ].map((item) => (
                    <li key={item} style={{ fontSize: 14, color: "rgba(234,242,242,0.85)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#fff", marginTop: 2, flexShrink: 0 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className="btn btn-sage"
                onClick={() => setModalOpen(true)}
                style={{ justifyContent: "center", fontSize: 15 }}
              >
                Save my spot →
              </button>
            </div>
          </div>
        </div>
      </section>

      <RegisterModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <style>{`
        .hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }
        .format-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .events-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .hero-grid > div:last-child {
            order: -1;
          }
          .format-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .events-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .format-grid {
            grid-template-columns: 1fr;
          }
          .events-grid {
            grid-template-columns: 1fr;
          }
        }
        .hero-media {
          aspect-ratio: 1 / 1;
          max-height: 520px;
          width: 100%;
        }
        .schedule-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          max-width: 760px;
          margin-inline: auto;
        }
        .btn-sage {
          background: var(--lime-600);
          color: #fff;
        }
        .btn-sage:hover {
          background: var(--lime-700);
        }
        .format-card {
          opacity: 0;
          transform: translateY(16px);
        }
        .format-grid.in-view .format-card {
          animation-name: fadeInUp;
          animation-duration: 0.55s;
          animation-timing-function: ease;
          animation-fill-mode: forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) {
          .hero-media { max-height: 340px; }
        }
        @media (max-width: 600px) {
          .schedule-grid { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .format-card { opacity: 1; transform: none; animation: none; }
        }
      `}</style>
    </>
  );
}
