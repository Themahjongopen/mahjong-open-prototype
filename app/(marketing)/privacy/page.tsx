import type { Metadata } from "next";
import PageBanner from "@/components/marketing/PageBanner";
import PolicyEmbed from "@/components/marketing/PolicyEmbed";

export const metadata: Metadata = {
  title: "Privacy Policy — The Mahjong Open",
};

export default function PrivacyPage() {
  return (
    <>
      <PageBanner
        eyebrow="Legal"
        headline={<>Privacy <em className="serif-italic">Policy</em></>}
        lead="How we collect, use, and protect your information."
      />
      <section style={{ padding: "56px 0 88px" }}>
        <div className="container-mo" style={{ maxWidth: 900 }}>
          <PolicyEmbed embedId="VVhaM2VVSkRiR1U1UlZwS2VWRTlQUT09" />
        </div>
      </section>
    </>
  );
}
