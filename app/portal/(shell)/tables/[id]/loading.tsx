import { Skeleton } from "@/components/portal/Skeleton";

// Table detail skeleton — back link, badges, title, meta card, seat rows, action.
export default function Loading() {
  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <Skeleton w={80} h={14} style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Skeleton w={70} h={22} r={999} />
        <Skeleton w={60} h={22} r={999} />
      </div>
      <Skeleton w={220} h={26} style={{ marginBottom: 12 }} />
      <Skeleton h={90} r="var(--radius-lg)" style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={52} r="var(--radius-lg)" />)}
      </div>
      <Skeleton h={46} r="var(--radius-lg)" />
    </div>
  );
}
