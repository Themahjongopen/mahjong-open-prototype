"use client";

import { useState } from "react";
import PageBanner from "@/components/marketing/PageBanner";
import CommissionerSection from "@/components/marketing/CommissionerSection";
import { ChevronDown } from "lucide-react";

const STEPS = [
  { n: "01", title: "Register for your city's series", body: "Choose your city, fill out your registration, and complete payment. Each series runs 8 weeks — one game per week." },
  { n: "02", title: "Get access to the player portal", body: "Once you're paid and confirmed, you'll receive login credentials for the private player portal. This is where your tables and standings live." },
  { n: "03", title: "Sign up for your weekly table", body: "Each week, browse open tables in your city — or create one. Pick your date, time, and location. You fill seat 1 automatically." },
  { n: "04", title: "Play your game", body: "Your foursome meets at the chosen spot. Play a full session of American mahjong. The table creator records the result." },
  { n: "05", title: "Submit the score", body: "After the game, the table creator enters each player's score. Scores are visible in the portal immediately and update the leaderboard within the series." },
  { n: "06", title: "Watch your standings update", body: "Your average score updates as the series progresses. Keep playing each week to climb the city leaderboard." },
];

const FAQS = [
  { q: "Do I have to play every week?", a: "No — there's no attendance requirement. Play as many of the 8 weeks as you'd like. Points only come from weeks you play." },
  { q: "Can I play more than one table per week?", a: "Each week you can claim a seat at one open table (or create your own). One game per week per player." },
  { q: "What if a player cancels?", a: "You can cancel your own seat up to 24 hours before game time. Within 24 hours, the seat is locked." },
  { q: "Who submits the score?", a: "Only the table creator can submit scores. All four seated players can see the pending score in their portal." },
  { q: "What mahjong rules do you use?", a: "The Mahjong Open uses American mahjong rules (NMJL card). All skill levels are welcome." },
  { q: "Can I join mid-series?", a: "Registration closes at the start of each series. Keep an eye out for early-bird registration for the next 8-week cycle." },
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
            Every week, paid players in your city can create or join a 4-person table. You pick the day, time, and location. The game happens. The creator submits the score. An admin approves it. Your points land on the leaderboard. Repeat.
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
