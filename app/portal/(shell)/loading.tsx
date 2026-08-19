import { Skeleton, SkeletonCard } from "@/components/portal/Skeleton";

// Dashboard skeleton — greeting, next-table hero, the four stat cards, the
// quick-actions grid, and the handbook card. Shape matches app/portal/(shell)/page.tsx.
export default function Loading() {
  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <Skeleton w={160} h={26} style={{ marginBottom: 20 }} />
      <Skeleton h={120} r="var(--radius-xl)" style={{ marginBottom: 20 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <SkeletonCard style={{ textAlign: "center" }}>
          <Skeleton w={40} h={24} style={{ margin: "0 auto 6px" }} />
          <Skeleton w={80} h={11} style={{ margin: "0 auto" }} />
        </SkeletonCard>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton w={100} h={11} style={{ marginBottom: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[0, 1].map((j) => (
                <div key={j} style={{ textAlign: "center" }}>
                  <Skeleton w={40} h={24} style={{ margin: "0 auto 6px" }} />
                  <Skeleton w={40} h={11} style={{ margin: "0 auto" }} />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={44} r="var(--radius-lg)" />)}
        <Skeleton h={44} r="var(--radius-lg)" style={{ gridColumn: "1 / -1" }} />
      </div>
      <Skeleton h={72} r="var(--radius-lg)" />
    </div>
  );
}
