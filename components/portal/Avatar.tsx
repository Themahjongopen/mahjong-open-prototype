// Member avatar: a real uploaded photo, or a neutral blank circle when none.
// No initials anywhere (per client direction).
export default function Avatar({ src, size = 32, alt = "" }: { src?: string | null; size?: number; alt?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: "var(--hair-200)",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : null}
    </div>
  );
}
