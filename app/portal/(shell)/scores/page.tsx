import Link from "next/link";
import { getPortalUser } from "@/lib/portal/session";
import { getEligibleScoreTables } from "@/lib/portal/scores";
import ScoreEntryForm from "@/components/portal/ScoreEntryForm";

export default async function ScoresPage({ searchParams }: { searchParams: Promise<{ table_id?: string }> }) {
  const { table_id } = await searchParams;
  const session = await getPortalUser();
  const member = session && session.status === "active" ? session : null;
  if (!member) return null;

  const tables = await getEligibleScoreTables(member);
  const initialTableId = table_id && tables.some((t) => t.id === table_id) ? table_id : tables[0]?.id ?? "";

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 20 }}>
        Enter round scores
      </p>

      {tables.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-500)" }}>
          <p style={{ marginBottom: 8 }}>No tables are ready for scoring.</p>
          <p style={{ fontSize: 13, marginBottom: 20 }}>
            Only tables you host and have marked as <strong>played</strong> (and not yet scored) appear here.
          </p>
          <Link href="/portal/my-tables" className="btn btn-primary" style={{ fontSize: 14, display: "inline-flex" }}>
            Go to My Tables →
          </Link>
        </div>
      ) : (
        <ScoreEntryForm tables={tables} initialTableId={initialTableId} />
      )}
    </div>
  );
}
