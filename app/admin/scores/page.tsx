import { getAdminSubmissions } from "@/lib/admin/scores";
import ScoreCorrectionCard from "@/components/admin/ScoreCorrectionCard";

export default async function AdminScoresPage() {
  const submissions = await getAdminSubmissions();

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 8 }}>Score Corrections</h1>
      <p style={{ fontSize: 15, color: "var(--ink-500)", marginBottom: 32 }}>
        Hosts submit round scores directly — no approval needed. Fix a typo or void a round here; standings update instantly.
      </p>

      {submissions.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 24, color: "var(--ink-500)", fontSize: 14 }}>
          No rounds have been scored yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {submissions.map((s) => (
            <ScoreCorrectionCard key={s.id} submission={s} />
          ))}
        </div>
      )}
    </div>
  );
}
