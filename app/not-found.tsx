import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--pink-wash)",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--hair-200)",
          borderRadius: "var(--radius-xl)",
          padding: "44px 40px",
          maxWidth: 460,
          textAlign: "center",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <Image
          src="/assets/logo-nav.svg?v=2"
          alt="The Mahjong Open"
          width={168}
          height={54}
          priority
          style={{ height: "auto", width: 168, margin: "0 auto 28px" }}
        />
        <p style={{ fontFamily: "var(--font-display)", fontSize: 54, color: "var(--pink-600)", lineHeight: 1, margin: "0 0 8px" }}>
          404
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, color: "var(--ink-900)", margin: "0 0 12px" }}>
          Page not found
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6, margin: "0 0 24px" }}>
          The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
