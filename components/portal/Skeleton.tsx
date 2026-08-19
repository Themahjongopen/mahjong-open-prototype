// Shared skeleton primitive for the portal's loading.tsx boundaries. Renders a
// shimmering block (see .skeleton in globals.css); loading files compose these to
// roughly match each page's shape so the transition doesn't jump when content
// arrives. Purely presentational, ships in the client bundle, renders instantly.
export function Skeleton({
  w = "100%",
  h = 16,
  r = 6,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, ...style }}
      aria-hidden
    />
  );
}

// A card-shaped skeleton matching the portal's standard card (white, hairline
// border, rounded, soft shadow) with skeleton children inside.
export function SkeletonCard({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--hair-200)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        boxShadow: "var(--shadow-xs)",
        ...style,
      }}
      aria-hidden
    >
      {children}
    </div>
  );
}
