import type { Metadata } from "next";
import ComingSoon from "./ComingSoon";

export const metadata: Metadata = {
  title: "Coming Soon — The Mahjong Open",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return <ComingSoon />;
}
