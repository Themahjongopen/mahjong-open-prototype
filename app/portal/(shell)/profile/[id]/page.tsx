import Link from "next/link";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";
import { getProfileStats, type StatBlock } from "@/lib/portal/profileStats";
import { getRegisterCityOptions } from "@/lib/portal/registerCity";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import ProfileEditForm from "@/components/portal/ProfileEditForm";
import Avatar from "@/components/portal/Avatar";

type SkillValue = "beginner" | "intermediate" | "advanced" | "";

function skillLine(skill: string | null) {
  if (!skill) return "Skill level not set";
  return `${skill.charAt(0).toUpperCase()}${skill.slice(1)} player`;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--hair-200)",
  borderRadius: "var(--radius-lg)",
  padding: 24,
  boxShadow: "var(--shadow-xs)",
};

function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
      {items.map((it) => (
        <div key={it.label} style={{ background: "var(--paper-50)", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-500)", margin: "0 0 6px" }}>{it.label}</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", margin: 0 }}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

function coreStats(b: StatBlock) {
  return [
    { label: "Games played", value: String(b.rounds) },
    { label: "Total score", value: String(b.totalScore) },
    { label: "Points per round", value: b.avgScore.toFixed(1) },
  ];
}

function notFound() {
  return (
    <div style={{ padding: "24px 16px", maxWidth: 640, margin: "0 auto" }}>
      <p style={{ fontSize: 15, color: "var(--ink-500)" }}>That member isn&rsquo;t in your directory.</p>
      <Link href="/portal/directory" style={{ color: "var(--pink-600)", fontWeight: 600, marginTop: 12, display: "inline-block" }}>
        Back to directory
      </Link>
    </div>
  );
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUser();
  const viewerId = session && session.status === "active" ? session.id : null;
  const isOwn = !!viewerId && id === viewerId;

  // Own-profile only: is there at least one more city this player can register
  // for in the active series? Gates the "register another city" entry point.
  const addCity = isOwn && session?.status === "active" ? await getRegisterCityOptions(session.memberships) : null;
  const canAddCity = !!addCity?.series && !addCity.registrationClosed && addCity.eligibleCities.length > 0;
  // Admins have no home cohort and see every city; resolve their active city so
  // the target row (which may now exist in multiple cities) stays a single row.
  const isAdminViewer = session?.status === "active" && session.isAdmin;
  const adminCtx = isAdminViewer ? await getAdminContext() : null;

  // Scope the lookup to one city: the admin's active city, or the viewer's
  // resolved active city. A multi-city viewer's RLS cohort spans both of their
  // cities, so the target could match two rows and .maybeSingle() would throw
  // without this; for a single-city viewer it's their only city (unchanged).
  const activeCityId = adminCtx
    ? adminCtx.cityId
    : session && session.status === "active"
      ? session.city_id
      : null;

  // Directory-safe view of the target, scoped to the viewer's cohort (member JWT).
  const supabase = await createClient();
  let dirQuery = supabase
    .from("directory_members")
    .select("profile_id, full_name, city_id, city_name, skill_level, is_commissioner, is_founding_player, series_id, avatar_url")
    .eq("profile_id", id);
  if (activeCityId) dirQuery = dirQuery.eq("city_id", activeCityId);
  const { data: dirRow } = await dirQuery.maybeSingle();

  // You can view yourself, or any member who shares your directory cohort.
  if (!dirRow && !isOwn) {
    return notFound();
  }

  const admin: any = createAdminClient();

  // Own private profile (email + editable fields) read via service-role.
  const ownProfile = isOwn && admin
    ? (
        await admin
          .from("profiles")
          .select("full_name, email, hometown, skill_level, notification_preferences, role, avatar_url")
          .eq("id", id)
          .maybeSingle()
      ).data
    : null;

  const fullName = dirRow?.full_name ?? ownProfile?.full_name ?? "Member";
  const cityName = dirRow?.city_name ?? null;
  const skill = (dirRow?.skill_level ?? ownProfile?.skill_level ?? null) as string | null;
  const avatarUrl = (dirRow?.avatar_url ?? ownProfile?.avatar_url ?? null) as string | null;
  const isCommissioner = dirRow?.is_commissioner ?? ownProfile?.role === "commissioner";
  const isFoundingPlayer = dirRow?.is_founding_player ?? false;
  // Scope season stats to a single (series, city). Prefer the directory row we
  // matched; for your own profile fall back to your active city (admin) or your
  // registration cohort (regular member) so opted-out members still see stats.
  const ownSeriesId = adminCtx ? adminCtx.seriesId : session?.status === "active" ? session.series_id : null;
  const ownCityId = adminCtx ? adminCtx.cityId : session?.status === "active" ? session.city_id : null;
  const seriesId = dirRow?.series_id ?? (isOwn ? ownSeriesId : null);
  const cityId = dirRow?.city_id ?? (isOwn ? ownCityId : null);

  const stats = admin ? await getProfileStats(admin, id, seriesId, cityId) : null;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <Link href="/portal/directory" style={{ color: "var(--pink-600)", fontWeight: 600, display: "inline-block" }}>
        ← Back to directory
      </Link>

      {/* Header */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
            <Avatar src={avatarUrl} size={64} alt={fullName} />
            <div style={{ minWidth: 0 }}>
              {cityName ? <p className="eyebrow" style={{ marginBottom: 6 }}>{cityName}</p> : null}
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-900)", margin: 0 }}>{fullName}</h2>
              <p style={{ fontSize: 14, color: "var(--ink-500)", marginTop: 6 }}>{skillLine(skill)}</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            {isCommissioner ? (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pink-700)", background: "var(--pink-50)", border: "1px solid var(--pink-100)", borderRadius: 999, padding: "6px 10px", whiteSpace: "nowrap" }}>
                Commissioner
              </span>
            ) : null}
            {isFoundingPlayer ? (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--crimson-600)", background: "var(--crimson-50)", border: "1px solid var(--crimson-100)", borderRadius: 999, padding: "6px 10px", whiteSpace: "nowrap" }}>
                Founding Player
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Current season stats */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: "0 0 16px" }}>Current season</h3>
        {stats ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <StatGrid items={coreStats(stats.season)} />
            <StatGrid
              items={[
                { label: "Ace Award", value: String(stats.season.aceAwardScore) },
                { label: "Ace Award rank", value: stats.season.aceAwardRank ? `#${stats.season.aceAwardRank}` : "—" },
                { label: "Champion Award", value: stats.season.championAwardScore.toFixed(1) },
                { label: "Champion Award rank", value: stats.season.championAwardRank ? `#${stats.season.championAwardRank}` : "—" },
                { label: "Flight Winner", value: stats.season.flightWinnerScore.toFixed(2) },
                { label: "Flight Winner rank", value: stats.season.flightWinnerRank ? `#${stats.season.flightWinnerRank}` : "—" },
              ]}
            />
          </div>
        ) : (
          <p style={{ fontSize: 14, color: "var(--ink-500)" }}>Stats aren&rsquo;t available right now.</p>
        )}
      </div>

      {/* All-time stats */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: "0 0 16px" }}>All-time</h3>
        {stats ? <StatGrid items={coreStats(stats.allTime)} /> : (
          <p style={{ fontSize: 14, color: "var(--ink-500)" }}>Stats aren&rsquo;t available right now.</p>
        )}
      </div>

      {/* Register another city (own profile, when something's eligible) */}
      {canAddCity ? (
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: "0 0 4px" }}>Would you like to play in an additional city?</h3>
          <p style={{ fontSize: 14, color: "var(--ink-500)", margin: "0 0 16px", lineHeight: 1.6 }}>
            You can register for additional cities in this series — each is its own registration and payment. Use code <strong>2NDCITY</strong> at checkout to register in your second city for only $35.
          </p>
          <Link href="/portal/register-city" className="btn btn-primary" style={{ display: "inline-flex", fontSize: 14 }}>
            Register another city
          </Link>
        </div>
      ) : null}

      {/* Own-profile editing */}
      {isOwn ? (
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: "0 0 4px" }}>Edit your profile</h3>
          {ownProfile?.email ? <p style={{ fontSize: 13, color: "var(--ink-500)", margin: "0 0 20px" }}>Signed in as {ownProfile.email}</p> : null}
          <ProfileEditForm
            userId={id}
            initialName={ownProfile?.full_name ?? fullName}
            initialHometown={ownProfile?.hometown ?? ""}
            initialSkill={((ownProfile?.skill_level ?? "") as SkillValue)}
            initialPrefs={resolvePrefs(ownProfile?.notification_preferences)}
            initialAvatarUrl={avatarUrl}
          />
        </div>
      ) : null}
    </div>
  );
}
