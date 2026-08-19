import { redirect } from "next/navigation";

// The rulebook is now a hosted PDF. Keep this route so old links/bookmarks
// still resolve — redirect them to the real handbook.
export default function RulebookPage() {
  redirect("/handbook/the-mahjong-open-handbook-2026-2.pdf");
}
