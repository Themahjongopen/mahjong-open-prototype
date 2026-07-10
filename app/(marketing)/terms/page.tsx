import type { Metadata } from "next";
import PageBanner from "@/components/marketing/PageBanner";
import PolicyEmbed from "@/components/marketing/PolicyEmbed";

export const metadata: Metadata = {
  title: "Terms of Service — The Mahjong Open",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <>
      <PageBanner
        eyebrow="Legal"
        headline={<>Terms of <em className="serif-italic">Service</em></>}
        lead="The terms that govern your use of The Mahjong Open."
      />
      <section style={{ padding: "56px 0 88px" }}>
        <div className="container-mo" style={{ maxWidth: 900 }}>
          <PolicyEmbed embedId="UVhKaFowdEpMMDU1TUZGaFlYYzlQUT09" />
        </div>
      </section>
    </>
  );
}
