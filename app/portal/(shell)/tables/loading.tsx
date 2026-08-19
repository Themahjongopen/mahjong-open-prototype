import { Skeleton } from "@/components/portal/Skeleton";

// Tables list skeleton — header + Create button, the Open/All toggle, a few cards.
export default function Loading() {
  return (
    <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <Skeleton w={90} h={12} style={{ marginBottom: 6 }} />
          <Skeleton w={120} h={22} />
        </div>
        <Skeleton w={84} h={34} r={999} />
      </div>
      <Skeleton h={40} r={999} style={{ marginBottom: 24 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} h={120} r="var(--radius-lg)" />)}
      </div>
    </div>
  );
}
