import { redirect } from "next/navigation";
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
      <header style={{ padding: "18px 24px", borderBottom: "1px solid var(--hair-200)", background: "#fff" }}>
        <p className="eyebrow" style={{ marginBottom: 4 }}>Commissioner view</p>
        <h1 className="h3" style={{ margin: 0 }}>Your city&rsquo;s players</h1>
      </header>
      <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
