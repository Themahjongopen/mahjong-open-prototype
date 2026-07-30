import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { getRegisterCityOptions } from "@/lib/portal/registerCity";
import RegisterCityForm from "@/components/portal/RegisterCityForm";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--hair-200)",
  borderRadius: "var(--radius-lg)",
  padding: 24,
  boxShadow: "var(--shadow-xs)",
};

function Notice({ children }: { children: React.ReactNode }) {
  return <div style={{ ...cardStyle, color: "var(--ink-700)", fontSize: 15, lineHeight: 1.6 }}>{children}</div>;
}

export default async function RegisterCityPage() {
  const session = await getPortalUser();
  if (!session || session.status !== "active") redirect("/portal");

  const { series, eligibleCities, registrationClosed } = await getRegisterCityOptions(session.memberships);

  // Reuse the player's existing profile details — nothing is re-collected.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  const { data: profile } = admin
    ? await admin.from("profiles").select("full_name, email, phone, skill_level, avatar_url").eq("id", session.id).maybeSingle()
    : { data: null };

  const profileComplete = Boolean(profile?.full_name && profile?.email && profile?.phone && profile?.avatar_url);

  return (
    <div style={{ padding: "24px 16px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Link href={`/portal/profile/${session.id}`} style={{ color: "var(--pink-600)", fontWeight: 600, display: "inline-block", marginBottom: 12 }}>
          ← Back to your profile
        </Link>
        {series ? <p className="eyebrow" style={{ marginBottom: 4 }}>{series.name}</p> : null}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-900)", margin: 0 }}>Register to play in another city</h2>
        <p style={{ fontSize: 15, color: "var(--ink-500)", marginTop: 8 }}>
          Join a second city in this series — a separate registration and payment. We&rsquo;ll reuse your profile details; just pick the city.
        </p>
        <p style={{ fontSize: 14, color: "var(--ink-700)", marginTop: 10 }}>
          Use code <strong>2NDCITY</strong> at checkout to register in your second city for only $35.
        </p>
      </div>

      {!series ? (
        <Notice>Registration isn&rsquo;t open right now. Check back soon.</Notice>
      ) : registrationClosed ? (
        <Notice>Registration for {series.name} has closed. Check back soon for the next one.</Notice>
      ) : eligibleCities.length === 0 ? (
        <Notice>
          You&rsquo;re already registered in every active city for this series — nothing left to add. See you at the table!
        </Notice>
      ) : !profileComplete ? (
        <Notice>
          Add a profile photo and phone number to{" "}
          <Link href={`/portal/profile/${session.id}`} style={{ color: "var(--pink-600)", fontWeight: 600 }}>your profile</Link>{" "}
          before registering another city — we reuse those details for the new registration.
        </Notice>
      ) : (
        <div style={cardStyle}>
          <RegisterCityForm
            eligibleCities={eligibleCities}
            seriesId={series.id}
            profile={{
              full_name: profile.full_name,
              email: profile.email,
              phone: profile.phone,
              skill_level: (profile.skill_level ?? "") as "beginner" | "intermediate" | "advanced" | "",
              avatar_url: profile.avatar_url,
            }}
          />
        </div>
      )}
    </div>
  );
}
