"use client";

import { useState } from "react";
import Image from "next/image";
import PageBanner from "@/components/marketing/PageBanner";
import CommissionerSection from "@/components/marketing/CommissionerSection";
import { ChevronDown } from "lucide-react";

const STEPS = [
  { n: "01", title: "Register for your city's league", body: "Choose your city, fill out your registration, and complete payment. Each league runs 8 weeks of open play." },
  { n: "02", title: "Get access to the player portal", body: "Once you're paid and confirmed, you'll receive login credentials for the private player portal. This is where your tables and standings live." },
  { n: "03", title: "Sign up for your weekly table", body: "Each week, browse open tables in your city — or create one. Pick your date, time, and location. You fill seat 1 automatically." },
  { n: "04", title: "Play your game", body: "Your foursome meets at the chosen spot. Play a full session of American mahjong. The table creator records the result." },
  { n: "05", title: "Submit the score", body: "After the round, the host enters each player's score. Scores are visible in the portal immediately and update the standings within the league." },
  { n: "06", title: "Watch your standings update", body: "The leaderboards update live as the league runs — Ace Award for your single best round, Champion Award summing your best round from every week, and Flight Winner for your best 7-of-8-week scoring average. Your city is also competing for the season's Mahjong Open Leader title." },
];

const FAQS = [
  { q: "Do I have to play every week?", a: "No — there's no attendance requirement. Play as many of the 8 weeks as you'd like. Points only come from weeks you play. The league concludes with your best 7 weeks of points." },
  { q: "Can I play more than one table per week?", a: "Yes — play as many games as you like each week. Claim seats at open tables or host your own; there's no weekly limit." },
  { q: "What if a player cancels?", a: "You can cancel your seat any time up to 24 hours before your table. Inside that window, a cancellation only counts as a no-show (−25 points) if your spot goes unfilled — so let your table know and someone can usually step in to take it. If no one does, the no-show is −25 and the three players who showed up each get +25 for that round." },
  { q: "Who submits the score?", a: "Only the table creator submits scores after the game. They're live in all four players' portals and the standings immediately — scoring runs on the honor system." },
  { q: "What mahjong rules do you use?", a: "The Mahjong Open uses American mahjong rules (NMJL card). All skill levels are welcome." },
  { q: "Can I join mid-league?", a: "Yes — registration for each league stays open through its first two weeks of play. For Fall League 2026 that's through August 31. Registration for the next league opens the day after the current one ends, so there's never a gap — Holiday League registration opens October 12." },
];

export default function HowItWorksPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageBanner
        eyebrow="Learn the league"
        headline={<>The mahjong league that <em className="serif-italic">keeps moving</em></>}
        lead="Eight weeks, one city, unlimited tables. Here's exactly how the league works."
      />

      {/* The basics */}
      <section style={{ padding: "72px 0" }}>
        <div className="container-mo" style={{ maxWidth: 800 }}>
          <p className="eyebrow" style={{ marginBottom: 16 }}>The basics</p>
          <h2 className="h2" style={{ marginBottom: 24 }}>One league. Eight weeks. <em className="serif-italic">Your pace.</em></h2>
          <p className="body-lg" style={{ marginBottom: 20 }}>
            The Mahjong Open runs city-by-city on a league schedule. Each league is exactly 8 weeks long. When you register, you&rsquo;re in for the full league in your city — play anywhere, play anytime.
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
          <h2 className="h2" style={{ marginBottom: 48 }}>How a league <em className="serif-italic">actually works</em></h2>
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
          <h2 className="h2" style={{ marginBottom: 24 }}>How the leaderboard works</h2>
          <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.65, marginBottom: 16 }}>
            After each round, the host submits every player&rsquo;s score. Results post to the portal immediately and update the standings within the league — no approval delay.
          </p>
          <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.65 }}>
            <strong>Ace Award</strong>{" "}tracks your single highest round score of the league — no minimum rounds required. <strong>Champion Award</strong>{" "}sums your single highest round from every week of the league. <strong>Flight Winner</strong>{" "}ranks your best 7-of-8-week combined scoring average (5 rounds minimum to qualify). Cities compete too: each city&rsquo;s top 3 individual round scores are added together, and the league&rsquo;s leading city is named The Mahjong Open Leader.
          </p>
        </div>
      </section>

      {/* Scorecard — illustrates the scoring just described. Pink-wash keeps the
          white→pink→lime section rhythm (Scoring white, FAQ lime). Desktop: a
          two-column split, text LEFT (so its eyebrow/heading stay on the same left
          edge as every other section) and the card RIGHT, vertically centered.
          Mobile: stacks, card centered. The card sits at a slight casual tilt and
          straightens + lifts on hover (hover-capable devices only; transition
          respects prefers-reduced-motion). Both the card and the text link open
          the printable PDF in a new tab. */}
      <section style={{ padding: "72px 0", background: "var(--pink-wash)" }}>
        <div className="container-mo" style={{ maxWidth: 800 }}>
          <div className="scorecard-split">
            <div className="scorecard-text">
              <p className="eyebrow" style={{ marginBottom: 16 }}>Score every game</p>
              <h2 className="h2" style={{ marginBottom: 24 }}>The official scorecard</h2>
              <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.65, marginBottom: 28 }}>
                Every table keeps score on the same card — print it at home or grab one from your host.
              </p>
              <p style={{ margin: 0 }}>
                <a href="/scorecard.pdf" target="_blank" rel="noopener noreferrer" download style={{ fontSize: 16, fontWeight: 600, color: "var(--pink-600)", textDecoration: "none" }}>
                  Print the scorecard →
                </a>
              </p>
            </div>
            <div className="scorecard-media">
              <a
                href="/scorecard.pdf"
                target="_blank"
                rel="noopener noreferrer"
                download
                aria-label="Open the printable Mahjong Open scorecard (PDF)"
                className="scorecard-card"
              >
                <Image
                  src="/scorecard-preview.png"
                  alt="The Mahjong Open official scorecard"
                  width={1200}
                  height={1650}
                  sizes="300px"
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              </a>
            </div>
          </div>
        </div>
        <style>{`
          .scorecard-split { display: flex; align-items: center; gap: 48px; }
          .scorecard-text { flex: 1; min-width: 0; }
          .scorecard-media { flex-shrink: 0; display: flex; justify-content: center; }
          .scorecard-card {
            display: block;
            width: 300px;
            max-width: 100%;
            border-radius: var(--radius-lg);
            overflow: hidden;
            border: 1px solid var(--hair-200);
            box-shadow: var(--shadow-sm);
            cursor: pointer;
            line-height: 0;
            /* Casual "set down on the table" tilt (transform, so it never affects
               layout or triggers reflow). */
            transform: rotate(-2.5deg);
          }
          /* Hover only on devices that truly hover — touch devices never get a
             stuck hover state. Straighten + lift + deepen the shadow; transform
             only, so surrounding layout can't shift. */
          @media (hover: hover) {
            .scorecard-card { transition: transform 250ms ease, box-shadow 250ms ease; }
            .scorecard-card:hover { transform: rotate(0deg) translateY(-6px); box-shadow: var(--shadow-lg); }
          }
          /* Users who asked for reduced motion get the states, not the animation. */
          @media (prefers-reduced-motion: reduce) {
            .scorecard-card { transition: none; }
          }
          @media (max-width: 768px) {
            .scorecard-split { flex-direction: column; align-items: stretch; gap: 32px; }
            .scorecard-media { width: 100%; }
          }
        `}</style>
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
