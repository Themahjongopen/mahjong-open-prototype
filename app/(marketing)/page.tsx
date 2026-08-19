"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RegisterModal from "@/components/marketing/RegisterModal";
import CommissionerSection from "@/components/marketing/CommissionerSection";
import LaunchCitiesMap from "@/components/marketing/LaunchCitiesMap";
import { Users, CalendarDays, Repeat2, Trophy, MapPin, Shuffle, Sparkles } from "lucide-react";

const FORMAT_STEPS = [
  {
    icon: Users,
    title: "Register for your city",
    body: "Join the league in your city. One registration covers your full 8-week league.",
  },
  {
    icon: CalendarDays,
    title: "Propose or accept rounds",
    body: "Propose a round or accept an existing round that fits your schedule. Play anywhere, play anytime. Any registered player in your city can host.",
  },
  {
    icon: Shuffle,
    title: "Play with new people",
    body: "Tables are open across all skill levels. Mix it up. Meet new players or play with familiar faces. The Mahjong Open is welcoming for all types of players due to the flexible format.",
  },
  {
    icon: Trophy,
    title: "Track your scores",
    body: "Scores are self-reported each round — Ace Award tracks your single best round score of the league, Champion Award sums your single best round from every week of the league, and Flight Winner ranks your best 7-of-8-week scoring average.",
  },
  {
    icon: Repeat2,
    title: "Climb the standings",
    body: "Track your rank on the city leaderboard — and help your city compete for the season's Mahjong Open Leader title.",
  },
  {
    icon: MapPin,
    title: "Play anywhere",
    body: "Tables happen wherever players want — homes, cafés, clubs. You choose the spot each week.",
  },
];

const SERIES_SCHEDULE = [
  {
    name: "Fall League",
    year: "2026",
    dates: "Aug 17 – Oct 11, 2026",
    body: "The inaugural 8-week league. Register, join tables across your city, and set the pace on the leaderboard.",
  },
  {
    name: "Holiday League",
    year: "2026",
    dates: "Oct 26 – Dec 20, 2026",
    body: "After a short break, the second 8-week league runs through the season. Registration opens as Fall League wraps.",
  },
];

const WHY_LOVE = [
  {
    icon: CalendarDays,
    title: "Play on your schedule",
    body: "Unlimited games across the 8-week league. Join an open table or host your own, whenever it suits you. Anywhere, anytime.",
  },
  {
    icon: Users,
    title: "Meet your city",
    body: "Every league brings your local players together — new tables, new faces, and a community that lasts.",
  },
  {
    icon: Sparkles,
    title: "All skill levels welcome",
    body: "New to mahjong or a longtime player, you belong here. From beginner and intermediate to advanced, there are rounds for everyone. All are welcome!",
  },
];

// Launch cities. Add another object here and the grid below
// accommodates it automatically — no layout changes needed. `description` is an
// optional tagline rendered under the name; omit it and the card shows nothing.
type LaunchCity = { name: string; state: string; photo: string; description?: string };

// Toggle the "See live launch status" map section on/off without deleting the
// section or its data — flip back to true to bring it back.
const SHOW_LAUNCH_MAP = false;

const LAUNCH_CITIES: LaunchCity[] = [
  { name: "Madison", state: "Mississippi", photo: "/brand-photo-2.jpg" },
  { name: "Gulf Coast", state: "Mississippi", photo: "/brand-photo-3.jpg" },
  { name: "Meridian", state: "Mississippi", photo: "/brand-photo-1.jpg" },
  { name: "Rankin County", state: "Mississippi", photo: "/brand-photo-4.jpg" },
  { name: "Golden Triangle", state: "Mississippi", photo: "/brand-photo-5.jpg" },
  { name: "Hattiesburg", state: "Mississippi", photo: "/brand-photo-6.jpg" },
  { name: "East Alabama", state: "Alabama", photo: "/brand-photo-7.jpg" },
  { name: "Franklin", state: "Tennessee", photo: "/brand-photo-8.jpg" },
  { name: "Greater Tuscaloosa", state: "Alabama", photo: "/brand-photo-9.jpg" },
  { name: "Charleston", state: "South Carolina", photo: "/brand-photo-10.jpg" },
  { name: "Baldwin County", state: "Alabama", photo: "/brand-photo-13.jpg" },
  { name: "Greenville/Pickens", state: "South Carolina", photo: "/brand-photo-18.jpg" },
  { name: "Central Arkansas", state: "Arkansas", photo: "/brand-photo-19.jpg" },
  { name: "Vicksburg", state: "Mississippi", photo: "/brand-photo-20.jpg" },
  { name: "Southwest Georgia", state: "Georgia", photo: "/brand-photo-22.jpg" },
  { name: "Dallas County", state: "Texas", photo: "/brand-photo-23.jpg" },
  { name: "Denton County", state: "Texas", photo: "/brand-photo-24.jpg" },
  { name: "South Tarrant Co.", state: "Texas", photo: "/brand-photo-25.jpg" },
  { name: "Memphis", state: "Tennessee", photo: "/brand-photo-26.jpg" },
  { name: "Enterprise", state: "Alabama", photo: "/brand-photo-27.jpg" },
  { name: "Fort Wayne", state: "Indiana", photo: "/brand-photo-29.jpg" },
  { name: "North Tarrant Co.", state: "Texas", photo: "/brand-photo-30.jpg" },
  { name: "Lubbock County", state: "Texas", photo: "/brand-photo-31.jpg" },
  { name: "Greater Boston Metro", state: "Massachusetts", photo: "/brand-photo-32.jpg" },
  { name: "San Antonio", state: "Texas", photo: "/brand-photo-33.jpg" },
  { name: "Collin County", state: "Texas", photo: "/brand-photo-35.jpg" },
  { name: "Northwest", state: "Mississippi", photo: "/brand-photo-36.jpg" },
  { name: "Philadelphia", state: "Mississippi", photo: "/brand-photo-38.jpg" },
  { name: "Raleigh", state: "North Carolina", photo: "/brand-photo-39.jpg" },
  { name: "Grand Rapids", state: "Michigan", photo: "/brand-photo-41.jpg" },
  { name: "Oklahoma City", state: "Oklahoma", photo: "/brand-photo-43.jpg" },
  { name: "Midland", state: "Texas", photo: "/brand-photo-45.jpg" },
  { name: "Tallahassee", state: "Florida", photo: "/brand-photo-11.jpg" },
  { name: "Kingwood", state: "Texas", photo: "/brand-photo-28.jpg" },
  { name: "Bloomington", state: "Indiana", photo: "/brand-photo-29.jpg" },
];


// Split the launch cities into balanced, symmetric rows of at most 4, with the
// larger rows toward the center (a centered pyramid) — e.g.
//   5 -> 3+2, 7 -> 4+3, 8 -> 4+4, 10 -> 3+4+3, 21 -> 3+4+4+4+3+3, ...
// Each row is centered in CSS.
function launchCityRows<T>(cities: T[]): T[][] {
  const n = cities.length;
  if (n === 0) return [];

  const rowCount = Math.ceil(n / 4);
  const base = Math.floor(n / rowCount);
  const sizes = new Array<number>(rowCount).fill(base);
  // Hand the remainder to the rows nearest the center first, so the middle
  // row(s) are the largest (21 cities -> 3 + 4 + 4 + 4 + 3 + 3, not edges-first).
  const mid = (rowCount - 1) / 2;
  const byCenter = [...sizes.keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  for (let k = 0; k < n - base * rowCount; k++) sizes[byCenter[k]]++;

  const rows: T[][] = [];
  let i = 0;
  for (const size of sizes) {
    rows.push(cities.slice(i, i + size));
    i += size;
  }
  return rows;
}

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
      {/* Top half — brand photo (aspect-ratio in CSS so it can shrink on mobile) */}
      <div className="launch-card-photo" style={{ position: "relative", width: "100%", background: "var(--pink-100)" }}>
        <Image
          src={city.photo}
          alt={`Players enjoying American mahjong at a styled table in ${city.name}.`}
          fill
          style={{ objectFit: "cover" }}
          sizes="(max-width: 900px) 90vw, 340px"
        />
      </div>
      {/* Bottom half — soft sage (padding in CSS so it can tighten on mobile) */}
      <div className="launch-card-body" style={{ background: "var(--lime-200)", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--lime-700)", marginBottom: 10 }}>
          Launch city
        </p>
        <h3
          className={`launch-card-title${city.name.length >= 20 ? " launch-card-title--long" : ""}`}
          style={{ fontFamily: "var(--font-display)", fontWeight: 400, color: "var(--ink-900)", lineHeight: 1.05, marginBottom: 8 }}
        >
          {city.name}
        </h3>
        <p style={{ fontSize: 14, color: "var(--ink-700)", margin: 0 }}>{city.state}</p>
        {/* Tagline LAST (below the state) so every card's name + state line up across
            a desktop row regardless of whether a card has one; only the optional
            tagline hangs below. Rendered only when present. */}
        {city.description ? (
          <p className="launch-card-tagline">{city.description}</p>
        ) : null}
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "What is The Mahjong Open?",
    a: "Mahjong Made Social — mahjong that brings your city together. Register once, play unlimited games over a flexible 8-week league, meet new friends, and climb your city's leaderboard.",
  },
  {
    q: "How much does it cost?",
    a: "$80 per 8-week league.",
  },
  {
    q: "How long is a league?",
    a: "Eight weeks, with five leagues a year.",
  },
  {
    q: "Do I need a partner or experience?",
    a: "No. A table seats four players, and all skill levels are welcome.",
  },
  {
    q: "How do standings work?",
    a: "Ace Award tracks your single highest round score of the league — no minimum rounds required. Champion Award sums your single highest round from every week of the league. Flight Winner ranks your best 7-of-8-week combined scoring average (5 rounds minimum to qualify). Cities also compete: each city's top 3 individual round scores are added together, and the leading city is named The Mahjong Open Leader.",
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
  const [referral, setReferral] = useState<{ code: string; cityId: string; host: string } | null>(null);
  const [formatVisible, setFormatVisible] = useState(false);
  const formatRef = useRef<HTMLDivElement | null>(null);
  const heroMediaRef = useRef<HTMLDivElement | null>(null);
  const [heroParallax, setHeroParallax] = useState(0);

  // Open the registration modal on ?register=1 (used by the /join/<code>
  // commissioner referral redirect, which also carries ref/city/host for
  // attribution). Then strip the params so a refresh doesn't re-trigger it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("register") !== "1") return;
    const ref = params.get("ref");
    const city = params.get("city");
    if (ref && city) setReferral({ code: ref, cityId: city, host: params.get("host") ?? "" });
    setModalOpen(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

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
                Mahjong Made <em className="serif-italic">Social</em>
              </h1>
              <p className="body-lg" style={{ maxWidth: 480 }}>
                Meet more friends. Play more Mahjong. Win more prizes. 8-week league with a flexible schedule.
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
                  { num: "8", label: "Weeks per league" },
                  { num: "5", label: "Leagues a year" },
                  { num: "$80", label: "Per league" },
                ].map((s) => (
                  <div key={s.label} style={{ marginLeft: s.label === "Per league" ? 16 : 0 }}>
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

      {/* What makes us different — multi-city registration */}
      <section style={{ padding: "72px 0", background: "var(--pink-wash)" }}>
        <div className="container-mo">
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Multi-city play</p>
            <h2 className="h2">
              What Makes The Mahjong Open{" "}<em className="serif-italic">Different</em>
            </h2>
          </div>
          <div
            style={{
              maxWidth: 680,
              marginInline: "auto",
              background: "#fff",
              border: "1px solid var(--hair-200)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              padding: "36px 32px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
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
              }}
            >
              <MapPin size={22} color="var(--pink-600)" />
            </div>
            <p className="body-lg" style={{ maxWidth: 560 }}>
              Register in more than one city and play in both — whether that&rsquo;s two cities near each
              other, or a hometown and the place you visit all summer. Each city keeps its own separate
              Ace Award, Champion Award, and Flight Winner leaderboard, so you&rsquo;re competing everywhere
              you register — while your city also competes against every other city for the season&rsquo;s
              Mahjong Open Leader title.
            </p>
            <p style={{ fontSize: 16, color: "var(--ink-700)", margin: 0 }}>
              Second city registration is just{" "}
              <strong style={{ color: "var(--pink-600)" }}>$35</strong>.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--ink-500)" }}>Use code</span>
              <span
                style={{
                  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  color: "var(--pink-700)",
                  background: "var(--pink-50)",
                  border: "1px dashed var(--pink-300)",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 12px",
                }}
              >
                2NDCITY
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Launch cities */}
      <section style={{ padding: "96px 0", background: "var(--bg)" }}>
        <div className="container-mo">
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <Sparkles size={14} /> Now playing
            </p>
            {/* Spelled-out count must match LAUNCH_CITIES.length (currently 35). A
                third hardcoded spot alongside the card array + the map pins — update
                all three together when the launch-city list changes. */}
            <h2 className="h2">Fall League is underway in{" "}<em className="serif-italic">thirty-five cities</em></h2>
            <p className="body-lg" style={{ marginTop: 16, maxWidth: 540, marginInline: "auto" }}>
              Play has begun, and registration is open through August 31. Take a seat at the table in your city.
            </p>
          </div>

          <div className="launch-cities-grid">
            {launchCityRows(LAUNCH_CITIES).map((row, i) => (
              <div className="launch-cities-row" key={i}>
                {row.map((city) => (
                  <LaunchCityCard key={city.name} city={city} />
                ))}
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", marginTop: 40 }}>
            <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", color: "var(--pink-700)", background: "#fff", border: "1px solid var(--pink-100)", borderRadius: "999px", padding: "7px 16px" }}>
              Fall League · Aug 17 – Oct 11, 2026
            </span>
          </p>

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)} style={{ fontSize: 15 }}>
              Save my spot →
            </button>
          </div>
        </div>
      </section>

      {SHOW_LAUNCH_MAP && (
        <section style={{ padding: "72px 0", background: "var(--pink-wash)" }}>
          <div className="container-mo">
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <h2 className="h2">See live launch status</h2>
              <p className="body-lg" style={{ marginTop: 16, maxWidth: 540, marginInline: "auto" }}>
                Every city needs 20 players to run. Hover a pin to see which cities are ready to go.
              </p>
            </div>
            <LaunchCitiesMap />
          </div>
        </section>
      )}

      {/* Stacking scroll group: each panel pins and the next slides in front */}
      <div className="stack-wrap">
      <CommissionerSection />

      {/* Series schedule */}
      <section className="stack-panel stack-panel--reveal" style={{ padding: "72px 0", background: "var(--pink-wash)" }}>
        <div className="container-mo">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>League schedule</p>
            <h2 className="h2">The 2026 <em className="serif-italic">League Schedule</em></h2>
            <p className="body-lg" style={{ marginTop: 16, maxWidth: 560, marginInline: "auto" }}>
              Each league runs 8 weeks of open play. There will be 5 leagues per year with breaks between.
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
                Registration includes your full 8-week league, access to all city tables, and a spot on the leaderboard.
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
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)", marginBottom: 12 }}>Your league includes:</p>
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

      <RegisterModal open={modalOpen} onClose={() => setModalOpen(false)} referral={referral} />

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
        /* Launch cities render as explicit balanced rows (max 4 per row) via
           launchCityRows() — e.g. 21 -> 3 + 4 + 4 + 4 + 3 + 3; it also handles
           the smaller counts (7 -> 4+3, 8 -> 4+4, 10 -> 3+4+3) and avoids a
           trailing orphan row of one. Every row centers, and cards keep full
           width so long names (e.g. "Greater Cartersville") stay on one line. On
           mobile each row's cards go full-width -> a clean single-column stack. */
        .launch-cities-grid {
          /* Column of rows; rows stretch to the full container width so each
             row's justify-content:center can center its cards (don't set
             align-items:center here — it shrink-wraps rows and breaks wrapping).
             gap here also sets the mobile card-to-card vertical spacing. */
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 1132px;
          margin-inline: auto;
        }
        .launch-cities-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
        }
        .launch-cities-row > * {
          flex: 0 1 265px;
          min-width: 205px;
        }
        /* Card photo aspect + body padding + title size live in CSS (not inline)
           so both breakpoints can be tuned independently. Two tightening passes so
           far: 2026-08-02 (16 cities) and 2026-08-03 (a second step down at 20
           cities / 7 rows — smaller cards, gaps, padding, and title). Photo aspect
           ratios kept unchanged across both. */
        .launch-card-photo { aspect-ratio: 8 / 5; }
        /* flex:1 so the green panel fills the rest of the card's flex column. Cards
           in a row stretch to the tallest (the one with a tagline), so without this
           the shorter cards left a white strip below their green; now that leftover
           becomes extra green bottom-padding and every green block ends at the same
           y, with the tagline living inside green space that already exists. */
        .launch-card-body { padding: 14px 18px 16px; flex: 1; }
        .launch-card-title { font-size: 23px; }
        /* Long names (>= 20 chars — currently "Greater Cartersville" and "Greater
           Boston Metro") don't fit the ~227px text area of the 265px desktop card
           at 23px: both wrap to two lines. Measured against the real display font,
           18px fits each on one line with margin — so step down to 18px. Only
           desktop needs this: the mobile
           card is full-width (single column, ~330px text area) where the name
           already fits, and the max-width:600px .launch-card-title 20px rule
           below overrides this one there (equal specificity, later in source), so
           mobile long names stay at the normal 20px. */
        .launch-card-title--long { font-size: 18px; }
        /* Optional tagline under the state line. Smaller + muted so it reads as a
           subtitle, not competing with the city name. text-wrap:balance evens the
           two lines instead of orphaning a trailing word; combined with the
           non-breaking hyphen in the data it keeps "Winston-Salem" intact. */
        .launch-card-tagline {
          font-size: 12px;
          line-height: 1.35;
          color: var(--ink-500);
          margin: 6px 0 0;
          text-wrap: balance;
        }
        @media (max-width: 600px) {
          /* One card per row on mobile: fill the column width and shorten each
             (wider/shorter photo crop + tighter text padding). Desktop untouched. */
          .launch-cities-row > * { flex-basis: 100%; }
          .launch-card-photo { aspect-ratio: 2 / 1; }
          .launch-card-body { padding: 11px 14px 14px; }
          .launch-card-title { font-size: 20px; }
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
