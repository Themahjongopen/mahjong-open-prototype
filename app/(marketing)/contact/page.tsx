"use client";

import { useState } from "react";
import PageBanner from "@/components/marketing/PageBanner";
import ConfirmationIcon from "@/components/ui/ConfirmationIcon";
import { Mail, Send, ChevronDown } from "lucide-react";

const FAQS = [
  { q: "How do I register for a city?", a: "Click Register on our home page or any page to open the registration modal. Choose your city and preferred day, complete payment, and you're in." },
  { q: "I forgot my portal password — what do I do?", a: "Go to the Sign In page and click 'Forgot password.' We'll email you a reset link." },
  { q: "Can I transfer my registration to a different city?", a: "City transfers are handled case by case. Reach out via the contact form and we'll do our best to help." },
  { q: "I submitted a score but it's not showing up — why?", a: "Scores are live the moment your table's host submits them — standings update in real time. Scoring runs on the honor system." },
  { q: "How do refunds work?", a: "Your $80 registration is fully refundable any time before your series begins. Once a series starts, registrations are non-refundable. And if your city doesn't reach the 20-player minimum needed to run, all registrants are refunded in full. Questions? Email themahjongopen@gmail.com." },
];

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ first: "", last: "", email: "", subject: "", message: "", website: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const contactLinkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 14,
    color: "var(--ink-700)",
    textDecoration: "none",
  };
  const contactIconBox: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "var(--radius-sm)",
    background: "var(--pink-50)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--pink-600)",
    flexShrink: 0,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, honeypot: form.website }),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageBanner
        eyebrow="Get in touch"
        headline={<>Let&rsquo;s <em className="serif-italic">talk tiles</em></>}
        lead="Questions about registration, your city, or the series? We're happy to help."
      />

      {/* FAQ */}
      <section style={{ padding: "72px 0" }}>
        <div className="container-mo" style={{ maxWidth: 720 }}>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Quick answers</p>
          <h2 className="h2" style={{ marginBottom: 40 }}>Common <em className="serif-italic">questions</em></h2>
          <div>
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

      {/* Contact form */}
      <section style={{ padding: "72px 0", background: "var(--pink-wash)" }}>
        <div className="container-mo">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }} className="contact-grid">
            <div>
              <p className="eyebrow" style={{ marginBottom: 16 }}>Send a message</p>
              <h2 className="h2" style={{ marginBottom: 16 }}>Still have <em className="serif-italic">questions?</em></h2>
              <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.65, marginBottom: 32 }}>
                Use the form to reach us. We respond within 1–2 business days. Have something time-sensitive? Choose &ldquo;Urgent membership question&rdquo; as your subject and we&rsquo;ll prioritize it.
              </p>

              {/* Social card */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid var(--hair-200)",
                  borderRadius: "var(--radius-lg)",
                  padding: "24px",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-800)", marginBottom: 16 }}>Connect with us</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <a href="https://www.instagram.com/themahjongopen/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={contactLinkStyle}>
                    <span style={contactIconBox}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="2" y="2" width="20" height="20" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
                      </svg>
                    </span>
                    @themahjongopen
                  </a>
                  <a href="https://www.facebook.com/themahjongopen/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" style={contactLinkStyle}>
                    <span style={contactIconBox}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
                      </svg>
                    </span>
                    The Mahjong Open
                  </a>
                  <a href="mailto:themahjongopen@gmail.com" aria-label="Email" style={contactLinkStyle}>
                    <span style={contactIconBox}>
                      <Mail size={18} />
                    </span>
                    themahjongopen@gmail.com
                  </a>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid var(--hair-200)",
                borderRadius: "var(--radius-lg)",
                padding: "36px 32px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {submitted ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <ConfirmationIcon name="chat" />
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-900)", marginBottom: 12 }}>Message sent!</h3>
                  <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6 }}>We&rsquo;ll get back to you within 1–2 business days.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>First name</label>
                      <input className="input-mo" placeholder="Jane" value={form.first} onChange={(e) => setForm((f) => ({ ...f, first: e.target.value }))} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Last name</label>
                      <input className="input-mo" placeholder="Smith" value={form.last} onChange={(e) => setForm((f) => ({ ...f, last: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Email</label>
                    <input className="input-mo" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Subject</label>
                    <select className="input-mo" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
                      <option value="">Select a subject</option>
                      <option>Registration question</option>
                      <option>Payment or billing</option>
                      <option>Portal access</option>
                      <option>Urgent membership question</option>
                      <option>New city inquiry</option>
                      <option>Something else</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Message</label>
                    <textarea
                      className="input-mo"
                      rows={5}
                      placeholder="Tell us what's on your mind…"
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: "center", marginTop: 4 }}>
                    <Send size={15} />
                    {loading ? "Sending…" : "Send message"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .contact-grid { grid-template-columns: 1fr 1fr !important; }
        @media (max-width: 900px) {
          .contact-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </>
  );
}
