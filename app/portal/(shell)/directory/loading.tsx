import { Skeleton, SkeletonCard } from "@/components/portal/Skeleton";

// Directory skeleton — header + a grid of member cards (avatar, name, skill).
export default function Loading() {
  return (
    <div style={{ padding: "20px 16px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Skeleton w={90} h={12} style={{ marginBottom: 6 }} />
        <Skeleton w={180} h={22} style={{ marginBottom: 8 }} />
        <Skeleton w="80%" h={14} />
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} style={{ padding: 18, display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton w={44} h={44} r="50%" />
            <div style={{ flex: 1 }}>
              <Skeleton w={140} h={15} style={{ marginBottom: 8 }} />
              <Skeleton w={90} h={13} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
