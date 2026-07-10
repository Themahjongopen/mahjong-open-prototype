import type { Metadata } from "next";
import PageBanner from "@/components/marketing/PageBanner";
import PolicyEmbed from "@/components/marketing/PolicyEmbed";

export const metadata: Metadata = {
  title: "Disclaimer — The Mahjong Open",
  robots: { index: false, follow: false },
};

export default function DisclaimerPage() {
  return (
    <>
      <PageBanner
        eyebrow="Legal"
        headline={<><em className="serif-italic">Disclaimer</em></>}
        lead="Important information about the content on this site."
      />
      <section style={{ padding: "56px 0 88px" }}>
        <div className="container-mo" style={{ maxWidth: 900 }}>
          <PolicyEmbed embedId="YldGRE9YcDBTbE5NVkdOa2NHYzlQUT09" />
        </div>
      </section>
    </>
  );
}
