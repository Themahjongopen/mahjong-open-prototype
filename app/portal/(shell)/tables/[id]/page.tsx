import { notFound } from "next/navigation";
import Link from "next/link";
import { getTableById, getScoreSubmissionForTable } from "@/lib/data";
import { getDemoUser } from "@/lib/data/auth";
import TableDetailClient from "./TableDetailClient";

export default async function TableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getDemoUser();
  const table = await getTableById(id);
  if (!table) notFound();
  const scoreSubmission = await getScoreSubmissionForTable(id);

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <Link href="/portal/tables" style={{ fontSize: 13, color: "var(--pink-600)", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16, textDecoration: "none" }}>
        ← Back to tables
      </Link>
      <TableDetailClient
        table={table}
        currentUserId={user.id}
        scoreSubmission={scoreSubmission ? { id: scoreSubmission.id, status: scoreSubmission.status } : null}
      />
    </div>
  );
}
