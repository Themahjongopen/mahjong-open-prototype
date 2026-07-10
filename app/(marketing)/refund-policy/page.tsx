import type { Metadata } from "next";
import PageBanner from "@/components/marketing/PageBanner";

export const metadata: Metadata = {
  title: "Refund Policy — The Mahjong Open",
  // Legal-style page — keep out of search, matching Terms/Privacy/Disclaimer.
  robots: { index: false, follow: false },
};

const SECTIONS = [
  {
    heading: "Before your series begins",
    body: "Your $80 registration is refundable any time before the first day of your series — you’ll receive the full $80 back to your original payment method.",
  },
  {
    heading: "Once your series has started",
    body: "Registrations are non-refundable from the first day of the series onward, as your spot, tables, and standings are active for the full 8 weeks.",
  },
  {
    heading: "If your city doesn’t reach its minimum",
    body: "A series only runs when a city reaches at least 20 registered players. If your city doesn’t reach 20 players, the series won’t run and all registrants receive a full refund automatically.",
  },
  {
    heading: "If we cancel",
    body: "If The Mahjong Open cancels a series for any other reason before it begins, you’ll receive a full refund (or the option to roll your registration to the next series).",
  },
];

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 22,
  fontWeight: 400,
  color: "var(--ink-900)",
  margin: "0 0 8px",
};
const bodyStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.65,
  color: "var(--ink-700)",
  margin: 0,
};

export default function RefundPolicyPage() {
  return (
    <>
      <PageBanner
        eyebrow="Legal"
        headline={<>Refund <em className="serif-italic">Policy</em></>}
        lead="How registration refunds work at The Mahjong Open."
      />
      <section style={{ padding: "56px 0 88px" }}>
        <div className="container-mo" style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 32 }}>
          {SECTIONS.map((s) => (
            <div key={s.heading}>
              <h2 style={headingStyle}>{s.heading}</h2>
              <p style={bodyStyle}>{s.body}</p>
            </div>
          ))}

          <div>
            <h2 style={headingStyle}>How to request a pre-start refund</h2>
            <p style={bodyStyle}>
              Email{" "}
              <a href="mailto:themahjongopen@gmail.com" style={{ color: "var(--pink-600)", textDecoration: "none" }}>
                themahjongopen@gmail.com
              </a>{" "}
              with your name and the city/series you registered for, before your series begins. Approved refunds are processed
              within 5&ndash;10 business days and may take a few additional days to appear, depending on your bank or card issuer.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
