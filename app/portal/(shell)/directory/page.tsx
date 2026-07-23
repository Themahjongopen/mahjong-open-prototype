import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";
import Avatar from "@/components/portal/Avatar";

type DirectoryRow = {
  profile_id: string;
  full_name: string | null;
  city_name: string | null;
  skill_level: string | null;
  is_commissioner: boolean;
  avatar_url: string | null;
};

function skillLabel(skill: string | null) {
  if (!skill) return "Member";
  return `${skill.charAt(0).toUpperCase()}${skill.slice(1)} player`;
}

export default async function DirectoryPage() {
  const session = await getPortalUser();
  const viewerId = session && session.status === "active" ? session.id : null;
  // Admins see every city via RLS, so scope the roster to their active city.
  const adminCtx = session && session.status === "active" && session.isAdmin ? await getAdminContext() : null;

  // Read the directory through the member's own JWT: the directory_members view
  // is RLS-scoped to the viewer's paid city+series cohort and exposes only
  // safe columns (no email/phone).
  const supabase = await createClient();
  let query = supabase
    .from("directory_members")
    .select("profile_id, full_name, city_name, skill_level, is_commissioner, avatar_url")
    .order("full_name", { ascending: true });
  if (adminCtx?.cityId) query = query.eq("city_id", adminCtx.cityId);
  const { data, error } = await query;

  const members = (data ?? []) as DirectoryRow[];
  const viewerRow = members.find((m) => m.profile_id === viewerId);
  const cityName = adminCtx?.cityName ?? viewerRow?.city_name ?? members[0]?.city_name ?? null;

  return (
    <div style={{ padding: "20px 16px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        {cityName ? <p className="eyebrow" style={{ marginBottom: 4 }}>{cityName}</p> : null}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>Member Directory</h2>
        <p style={{ fontSize: 15, color: "var(--ink-500)", marginTop: 8 }}>
          Your city roster for this series — connect with players and see who&rsquo;s active.
        </p>
      </div>

      {error ? (
        <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 20, color: "var(--ink-500)", fontSize: 14 }}>
          The directory couldn&rsquo;t be loaded right now. Please try again shortly.
        </div>
      ) : members.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 20, color: "var(--ink-500)", fontSize: 14 }}>
          No other members have joined your city for this series yet. Check back soon.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {members.map((member) => {
            const isYou = member.profile_id === viewerId;
            return (
              <div
                key={member.profile_id}
                style={{
                  background: "#fff",
                  border: "1px solid var(--hair-200)",
                  borderRadius: "var(--radius-lg)",
                  padding: "18px",
                  boxShadow: "var(--shadow-xs)",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <Avatar src={member.avatar_url} size={44} alt={member.full_name ?? "Member"} />
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/portal/profile/${member.profile_id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", marginBottom: 6 }}>
                        {member.full_name ?? "Member"}
                        {isYou ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-400)", marginLeft: 8 }}>You</span> : null}
                      </p>
                    </Link>
                    <p style={{ fontSize: 13, color: "var(--ink-500)" }}>{skillLabel(member.skill_level)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  {member.is_commissioner ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pink-700)", background: "var(--pink-50)", border: "1px solid var(--pink-100)", borderRadius: 999, padding: "4px 8px", whiteSpace: "nowrap" }}>
                      Commissioner
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
