"use client";

import { useState } from "react";
import PageBanner from "@/components/marketing/PageBanner";
import CommissionerSection from "@/components/marketing/CommissionerSection";
import { ChevronDown } from "lucide-react";

const STEPS = [
  { n: "01", title: "Register for your city's series", body: "Choose your city, fill out your registration, and complete payment. Each series runs 8 weeks of open play." },
  { n: "02", title: "Get access to the player portal", body: "Once you're paid and confirmed, you'll receive login credentials for the private player portal. This is where your tables and standings live." },
  { n: "03", title: "Sign up for your weekly table", body: "Each week, browse open tables in your city — or create one. Pick your date, time, and location. You fill seat 1 automatically." },
  { n: "04", title: "Play your game", body: "Your foursome meets at the chosen spot. Play a full session of American mahjong. The table creator records the result." },
  { n: "05", title: "Submit the score", body: "After the game, the table creator enters each player's score. Scores are visible in the portal immediately and update the leaderboard within the series." },
  { n: "06", title: "Watch your standings update", body: "Your average score updates as the series progresses. Keep playing each week to climb the city leaderboard." },
];

const FAQS = [
  { q: "Do I have to play every week?", a: "No — there's no attendance requirement. Play as many of the 8 weeks as you'd like. Points only come from weeks you play." },
  { q: "Can I play more than one table per week?", a: "Yes — play as many games as you like each week. Claim seats at open tables or host your own; there's no weekly limit." },
  { q: "What if a player cancels?", a: "You can cancel your seat up to 24 hours before your table time. Late cancellations and no-shows are recorded as −25 points, and the three players who do show up receive 25 points each for that game. Can't make it inside the 24-hour window? You can also send a replacement player to take your seat instead." },
  { q: "Who submits the score?", a: "Only the table creator submits scores after the game. They're live in all four players' portals and the standings immediately — scoring runs on the honor system." },
  { q: "What mahjong rules do you use?", a: "The Mahjong Open uses American mahjong rules (NMJL card). All skill levels are welcome." },
  { q: "Can I join mid-series?", a: "Yes — registration stays open for the first two weeks of each series. After that, it closes until the next series." },
];

export default function HowItWorksPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageBanner
        eyebrow="Learn the league"
        headline={<>The mahjong league that <em className="serif-italic">keeps moving</em></>}
        lead="Eight weeks, one city, unlimited tables. Here's exactly how the series works."
      />

      {/* The basics */}
      <section style={{ padding: "72px 0" }}>
        <div className="container-mo" style={{ maxWidth: 800 }}>
          <p className="eyebrow" style={{ marginBottom: 16 }}>The basics</p>
          <h2 className="h2" style={{ marginBottom: 24 }}>One series. Eight weeks. <em className="serif-italic">Your pace.</em></h2>
          <p className="body-lg" style={{ marginBottom: 20 }}>
            The Mahjong Open runs city-by-city on a series schedule. Each series is exactly 8 weeks long. When you register, you&rsquo;re in for the full series in your city — but you choose which weeks to play.
          </p>
          <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.65 }}>
            Every week, paid players in your city can create or join a 4-person table. You pick the day, time, and location. The game happens. The table creator submits the score, and it lands in every player&rsquo;s portal and the standings immediately. Repeat.
          </p>
        </div>
      </section>

      {/* Step by step */}
      <section style={{ padding: "72px 0", background: "var(--pink-wash)" }}>
        <div className="container-mo">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Step by step</p>
          <h2 className="h2" style={{ marginBottom: 48 }}>How a series <em className="serif-italic">actually works</em></h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {STEPS.map((step) => (
              <div
                key={step.n}
                style={{
                  display: "flex",
                  gap: 32,
                  background: "#fff",
                  border: "1px solid var(--hair-200)",
                  borderRadius: "var(--radius-lg)",
                  padding: "28px 32px",
                  boxShadow: "var(--shadow-sm)",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 36,
                    fontWeight: 400,
                    color: "var(--pink-200)",
                    lineHeight: 1,
                    flexShrink: 0,
                    minWidth: 48,
                  }}
                >
                  {step.n}
                </span>
                <div>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--ink-900)", marginBottom: 8 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.65 }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section style={{ padding: "72px 0" }}>
        <div className="container-mo" style={{ maxWidth: 800 }}>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Scoring &amp; standings</p>
          <h2 className="h2" style={{ marginBottom: 24 }}>Averages decide the leaderboard</h2>
          <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.65, marginBottom: 16 }}>
            After each game, the table creator submits results — wins and points per player. Scores are visible in the portal immediately and update the leaderboard within the series.
          </p>
          <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.65 }}>
            Standings rank players by average score across all games played in the 8-week series. Keep playing to improve your position and finish strong.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "72px 0", background: "var(--lime-wash)" }}>
        <div className="container-mo" style={{ maxWidth: 720 }}>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Common questions</p>
          <h2 className="h2" style={{ marginBottom: 40 }}>FAQ</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderBottom: "1px solid var(--hair-200)" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "20px 0",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    gap: 16,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-900)" }}>{faq.q}</span>
                  <ChevronDown
                    size={18}
                    color="var(--ink-500)"
                    style={{ flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
                {openFaq === i && (
                  <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.65, paddingBottom: 20, margin: 0 }}>
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <CommissionerSection />
    </>
  );
}
