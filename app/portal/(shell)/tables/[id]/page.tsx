import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalUser } from "@/lib/portal/session";
import { getTableDetail } from "@/lib/portal/tables";
import TableDetailClient from "./TableDetailClient";

export default async function TableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUser();
  const member = session && session.status === "active" ? session : null;
  const table = member ? await getTableDetail(id, member) : null;
  if (!member || !table) notFound();

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <Link href="/portal/tables" style={{ fontSize: 13, color: "var(--pink-600)", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16, textDecoration: "none" }}>
        ← Back to tables
      </Link>
      <TableDetailClient table={table} currentUserId={member.id} />
    </div>
  );
}
