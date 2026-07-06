import Link from "next/link";
import { getAdminPlayers, getMembership } from "@/lib/data";
import { getDemoUser } from "@/lib/data/auth";

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getDemoUser();
  const membership = await getMembership(user.id);
  const members = await getAdminPlayers();
  const member = members.find((entry) => entry.id === id) ?? null;

  if (!member) {
    return (
      <div style={{ padding: "24px 16px", maxWidth: 640, margin: "0 auto" }}>
        <p style={{ fontSize: 15, color: "var(--ink-500)" }}>Player not found.</p>
        <Link href="/portal/directory" style={{ color: "var(--pink-600)", fontWeight: 600, marginTop: 12, display: "inline-block" }}>
          Back to directory
        </Link>
      </div>
    );
  }

  const cityName = membership?.cities?.name ?? member.cities.name;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 640, margin: "0 auto" }}>
      <Link href="/portal/directory" style={{ color: "var(--pink-600)", fontWeight: 600, marginBottom: 16, display: "inline-block" }}>
        ← Back to directory
      </Link>

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-xs)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>{cityName}</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-900)", margin: 0 }}>{member.profiles.full_name}</h2>
          </div>
          {member.profiles.role === "commissioner" ? (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pink-700)", background: "var(--pink-50)", border: "1px solid var(--pink-100)", borderRadius: 999, padding: "6px 10px", whiteSpace: "nowrap" }}>
              Commissioner
            </span>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 10, color: "var(--ink-700)" }}>
          <p><strong>Email:</strong> {member.profiles.email}</p>
          <p><strong>Skill level:</strong> {member.skill_level}</p>
          <p><strong>Season:</strong> {member.seasons.name}</p>
        </div>
      </div>
    </div>
  );
}
