import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPortalUser } from "@/lib/portal/session";

export default async function CommissionerLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalUser();

  if (!session) {
    redirect("/portal/login");
  }
  if (session.status !== "active" || session.role !== "commissioner" || !session.commissionerCityId) {
    redirect("/portal");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ padding: "18px 24px", borderBottom: "1px solid var(--hair-200)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Commissioner view</p>
          <h1 className="h3" style={{ margin: 0 }}>Your city&rsquo;s players</h1>
        </div>
        <Link href="/portal" className="btn" style={{ fontSize: 13, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} />
          Back to player portal
        </Link>
      </header>
      <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
