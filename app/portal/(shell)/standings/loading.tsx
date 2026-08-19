import { Skeleton } from "@/components/portal/Skeleton";

// Standings skeleton — heading + a run of ranked rows.
export default function Loading() {
  return (
    <div style={{ padding: "20px 16px", maxWidth: 640, margin: "0 auto" }}>
      <Skeleton w={150} h={22} style={{ marginBottom: 20 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} h={48} r="var(--radius-lg)" />)}
      </div>
    </div>
  );
}
