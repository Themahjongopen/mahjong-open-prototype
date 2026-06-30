import Link from "next/link";

export default function CommissionerSection() {
  return (
    <section
      style={{
        padding: "72px 0 88px",
        background: "var(--bg)",
        borderTop: "1px solid var(--hair-200)",
      }}
    >
      <div className="container-mo">
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--hair-200)",
            borderRadius: "var(--radius-xl)",
            padding: "48px 40px",
            boxShadow: "var(--shadow-sm)",
            animation: "fadeIn 0.6s ease",
          }}
        >
          <p className="eyebrow" style={{ marginBottom: 14 }}>
            Lead a city
          </p>
          <h2 className="h2" style={{ marginBottom: 16 }}>
            Bring the Mahjong Open to your city
          </h2>
          <p className="body-lg" style={{ maxWidth: 640, marginBottom: 28 }}>
            The Mahjong Open grows one community at a time. If you love the game and want to build something local, you can lead the Mahjong Open in your city as its commissioner — we’ll bring the structure, the brand, and the support. No franchise fees. No buy-in.
          </p>
          <Link
            href="/lead-a-city"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ fontSize: 15 }}
          >
            Apply to lead a city
          </Link>
        </div>
      </div>
    </section>
  );
}
