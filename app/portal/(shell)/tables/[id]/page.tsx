import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalClaims } from "@/lib/portal/session";
import { getTableDetail } from "@/lib/portal/tables";
import { getSubmissionForTable } from "@/lib/portal/scores";
import TableDetailClient from "./TableDetailClient";

export default async function TableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Read-only table detail: locally-verified claims are enough. The seat-join /
  // leave / score actions inside TableDetailClient POST to API routes that
  // re-check with the strong getPortalUser, so no mutation trusts these claims.
  const session = await getPortalClaims();
  const member = session && session.status === "active" ? session : null;
  const table = member ? await getTableDetail(id, member) : null;
  if (!member || !table) notFound();

  const submission = await getSubmissionForTable(id);

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <Link href="/portal/tables" style={{ fontSize: 13, color: "var(--pink-600)", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16, textDecoration: "none" }}>
        ← Back to tables
      </Link>
      <TableDetailClient table={table} currentUserId={member.id} isAdmin={member.isAdmin} submission={submission} />
    </div>
  );
}
