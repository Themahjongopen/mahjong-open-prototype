import { Skeleton, SkeletonCard } from "@/components/portal/Skeleton";

// Profile skeleton — avatar + name header, then the season-stats grid.
export default function Loading() {
  return (
    <div style={{ padding: "24px 16px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Skeleton w={72} h={72} r="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton w={160} h={22} style={{ marginBottom: 8 }} />
          <Skeleton w={110} h={14} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton w={60} h={20} style={{ marginBottom: 8 }} />
            <Skeleton w={80} h={12} />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
