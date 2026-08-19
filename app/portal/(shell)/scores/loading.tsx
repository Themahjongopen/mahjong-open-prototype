import { Skeleton } from "@/components/portal/Skeleton";

// Scores skeleton — heading, table selector, a few score rows, submit.
export default function Loading() {
  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <Skeleton w={170} h={22} style={{ marginBottom: 20 }} />
      <Skeleton w={60} h={13} style={{ marginBottom: 6 }} />
      <Skeleton h={44} r="var(--radius-md)" style={{ marginBottom: 20 }} />
      <Skeleton w={110} h={13} style={{ marginBottom: 10 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={48} r="var(--radius-md)" />)}
      </div>
      <Skeleton h={46} r="var(--radius-md)" style={{ marginTop: 20 }} />
    </div>
  );
}
