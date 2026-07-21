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
    title: "Propose or accept rounds",
    body: "Propose a round or accept an existing round that fits your schedule. Play as much or as little as you want. Any registered player in your city can host.",
  },
  {
    icon: Shuffle,
    title: "Play with new people",
    body: "Tables are open across all skill levels. Mix it up. Meet new players or play with familiar faces. The Mahjong Open is welcoming for all types of players due to the flexible format.",
  },
  {
    icon: Trophy,
    title: "Track your scores",
    body: "Scores are self-reported each round — Top Leader Score sums your best 7 weekly totals, and Top Average Score ranks your per-round average (minimum 5 rounds).",
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
    dates: "Oct 26 – Dec 20, 2026",
    body: "After a short break, the second 8-week series runs through the season. Registration opens as Series One wraps.",
  },
];

const WHY_LOVE = [
  {
    icon: CalendarDays,
    title: "Play on your schedule",
    body: "Unlimited games across the 8-week series. Join an open table or host your own, whenever it suits you. Anywhere, anytime.",
  },
  {
    icon: Users,
    title: "Meet your city",
    body: "Every series brings your local players together — new tables, new faces, and a community that lasts.",
  },
  {
    icon: Sparkles,
    title: "All skill levels welcome",
    body: "New to mahjong or a longtime player, you belong here. From beginner and intermediate to advanced, there are rounds for everyone. All are welcome!",
  },
];

// Series One launch cities. Add another object here and the grid below
// accommodates it automatically — no layout changes needed.
const LAUNCH_CITIES = [
  { name: "Madison", state: "Mississippi", photo: "/brand-photo-2.jpg" },
  { name: "Ocean Springs", state: "Mississippi", photo: "/brand-photo-3.jpg" },
];

type LaunchCity = (typeof LAUNCH_CITIES)[number];

function LaunchCityCard({ city }: { city: LaunchCity }) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        border: "1px solid var(--hair-200)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top half — brand photo */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "var(--pink-100)" }}>
        <Image
          src={city.photo}
          alt={`Players enjoying American mahjong at a styled table in ${city.name}.`}
          fill
          style={{ objectFit: "cover" }}
          sizes="(max-width: 900px) 90vw, 340px"
        />
      </div>
      {/* Bottom half — soft sage */}
      <div style={{ background: "var(--lime-200)", padding: "30px 28px 34px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--lime-700)", marginBottom: 10 }}>
          Launch city
        </p>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 400, color: "var(--ink-900)", lineHeight: 1.05, marginBottom: 8 }}>
          {city.name}
        </h3>
        <p style={{ fontSize: 15, color: "var(--ink-700)", margin: 0 }}>{city.state}</p>
      </div>
    </div>
  );
}

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
    a: "Top Leader Score sums your best 7 weekly totals across the 8-week series — a weekly total is your top two round scores that week. Top Average Score ranks your average points per round, once you've played at least five rounds.",
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
  const heroMediaRef = useRef<HTMLDivElement | null>(null);
  const [heroParallax, setHeroParallax] = useState(0);

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

  // Subtle scroll parallax on the hero image (respects reduced-motion)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = heroMediaRef.current;
      if (!el) return;
      // Parallax on desktop only; keep the image static on mobile
      if (window.innerWidth < 900) {
        setHeroParallax(0);
        return;
      }
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = rect.top + rect.height / 2;
      const progress = (center - vh / 2) / (vh / 2 + rect.height / 2); // ~ -1..1
      const clamped = Math.max(-1, Math.min(1, progress));
      setHeroParallax(-clamped * 60);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      {/* Hero */}
      <section style={{ padding: "40px 0 80px", background: "var(--bg)" }}>
        <div className="container-mo">
          <div className="hero-grid">
            {/* Copy */}
            <div className="hero-copy" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
              <p className="eyebrow">The Mahjong Open</p>
              <h1 className="h1" style={{ fontSize: "clamp(32px, 4.2vw, 46px)" }}>
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
              {/* Decorative pink accent line, offset behind the image so it peeks out on the right & bottom */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: "translate(9px, 9px)",
                  border: "1px solid var(--pink-400)",
                  borderRadius: "var(--radius-xl)",
                  zIndex: 0,
                  pointerEvents: "none",
                }}
              />
              <div
                className="hero-media"
                ref={heroMediaRef}
                style={{
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  background: "var(--pink-100)",
                  boxShadow: "var(--shadow-lg)",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <Image
                  src="/hero.jpg"
                  alt="Four friends playing American mahjong together at a styled table."
                  fill
                  style={{
                    objectFit: "cover",
                    objectPosition: "center",
                    transform: `translate3d(0, ${heroParallax}px, 0) scale(1.24)`,
                    willChange: "transform",
                  }}
                  priority
                  sizes="(max-width: 900px) 100vw, 50vw"
                />
                {/* Fallback shown if /hero.jpg is missing */}
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
            <h2 className="h2">The League,{" "}<em className="serif-italic">Explained</em></h2>
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

      {/* Launch cities */}
      <section style={{ padding: "96px 0", background: "var(--bg)" }}>
        <div className="container-mo">
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <Sparkles size={14} /> Now launching
            </p>
            <h2 className="h2">Series One starts in{" "}<em className="serif-italic">two cities</em></h2>
            <p className="body-lg" style={{ marginTop: 16, maxWidth: 540, marginInline: "auto" }}>
              Our inaugural 8-week series kicks off this August. Be one of the first to take a seat at the table in your city.
            </p>
          </div>

          <div className="launch-cities-grid">
            {LAUNCH_CITIES.map((city) => (
              <LaunchCityCard key={city.name} city={city} />
            ))}
          </div>

          <p style={{ textAlign: "center", marginTop: 40 }}>
            <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", color: "var(--pink-700)", background: "#fff", border: "1px solid var(--pink-100)", borderRadius: "999px", padding: "7px 16px" }}>
              Series One · Aug 17 – Oct 11, 2026
            </span>
          </p>

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)} style={{ fontSize: 15 }}>
              Save my spot →
            </button>
          </div>
        </div>
      </section>

      {/* Stacking scroll group: each panel pins and the next slides in front */}
      <div className="stack-wrap">
      <CommissionerSection />

      {/* Series schedule */}
      <section className="stack-panel stack-panel--reveal" style={{ padding: "72px 0", background: "var(--pink-wash)" }}>
        <div className="container-mo">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Series schedule</p>
            <h2 className="h2">The 2026 <em className="serif-italic">Series Schedule</em></h2>
            <p className="body-lg" style={{ marginTop: 16, maxWidth: 560, marginInline: "auto" }}>
              Each series runs 8 weeks of open play. There will be 5 series per year with breaks between.
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
      <section className="stack-panel stack-panel--reveal" style={{ padding: "80px 0", background: "var(--peri-50)" }}>
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
      </div>
      {/* end stacking scroll group */}

      {/* FAQ */}
      <section className="faq-section" style={{ padding: "72px 0", background: "var(--bg)" }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <div className="container-mo" style={{ maxWidth: 760 }}>
          <h2 className="h2" style={{ marginBottom: 32, fontSize: "clamp(22px, 3vw, 30px)" }}>
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
      <section className="cta-section" style={{ padding: "72px 0" }}>
        <div className="container-mo">
          <div
            style={{
              background: "var(--pink-50)",
              border: "1px solid var(--pink-100)",
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
                  color: "var(--pink-600)",
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
                  color: "var(--ink-900)",
                  lineHeight: 1.1,
                  marginBottom: 16,
                }}
              >
                Ready to play?{" "}
                <em className="serif-italic" style={{ color: "var(--pink-600)" }}>Save your spot.</em>
              </h2>
              <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6 }}>
                Registration includes your full 8-week series, access to all city tables, and a spot on the leaderboard.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 260 }}>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid var(--hair-200)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px 24px",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)", marginBottom: 12 }}>Your series includes:</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "8 weeks of open play",
                    "Access to all open tables in your city",
                    "Live standings & score tracking",
                    "A spot in the member directory",
                  ].map((item) => (
                    <li key={item} style={{ fontSize: 14, color: "var(--ink-700)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "var(--pink-500)", marginTop: 2, flexShrink: 0 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className="btn btn-primary"
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
          /* Top-align the columns; the copy then gets a small top offset below
             (desktop only) so it lands halfway between centered and top-aligned. */
          align-items: start;
        }
        @media (min-width: 901px) {
          /* Midpoint between vertically-centered and top-aligned against the
             520px hero image (measured: centered = 70px below image top). */
          .hero-copy { margin-top: 35px; }
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
        /* Sticky "stacking" scroll sections: each pins, the next slides in front */
        .stack-panel {
          position: sticky;
          top: 0;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        /* Keep the inner container full width inside the flex panel
           (otherwise auto side-margins shrink it and the cards wrap) */
        .stack-panel > .container-mo {
          width: 100%;
        }
        .stack-panel--reveal {
          border-top-left-radius: 28px;
          border-top-right-radius: 28px;
          box-shadow: 0 -12px 44px rgba(31, 56, 67, 0.1);
        }
        @media (max-width: 900px) {
          .stack-panel {
            position: static;
            min-height: 0;
          }
          .stack-panel--reveal {
            border-top-left-radius: 0;
            border-top-right-radius: 0;
            box-shadow: none;
          }
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
        /* Flexible card grid — auto-fits any number of cities, centered.
           Add a city to LAUNCH_CITIES and the grid absorbs it automatically. */
        .launch-cities-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 340px));
          gap: 28px;
          justify-content: center;
          max-width: 1080px;
          margin-inline: auto;
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
          /* Mobile: show the full 1:1 photo with no crop. The square image in a
             square box (no height cap) fills with zero cropping; drop the desktop
             scale(1.24) zoom (inline on the img) so the raised hands and the
             tiles at top/bottom aren't clipped. Parallax translate is already 0
             on mobile; this removes the residual zoom. Desktop is untouched. */
          .hero-media { max-height: none; }
          .hero-media img { transform: none !important; }
          /* Tighten the tall FAQ→CTA whitespace on mobile (desktop keeps 72px). */
          .faq-section { padding-bottom: 36px !important; }
          .cta-section { padding-top: 36px !important; }
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
