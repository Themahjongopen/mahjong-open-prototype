import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";

// Public commissioner referral landing route: /join/<code>.
//
// Resolves the code, then always redirects to the homepage with the registration
// modal open (?register=1). If the code is valid + active, it also carries the
// code, the commissioner's city (preselected in the modal), and the
// commissioner's name (for the quiet "Registering with …" confirmation). If the
// code is unknown or inactive, we redirect with NO attribution params — a dead
// link must never show a woman an error; she just lands on a working form.
//
// Reachable unauthenticated: /join is allowlisted in proxy.ts. All lookups use
// the service-role client (commissioner_referral_codes has no permissive RLS).
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (admin && code) {
    try {
      const { data } = await admin
        .from("commissioner_referral_codes")
        .select("code, city_id, is_active, profiles(full_name)")
        .eq("code", code)
        .maybeSingle();

      if (data && data.is_active) {
        const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
        const host = (profile?.full_name ?? "").trim();
        const qs = new URLSearchParams({ register: "1", ref: data.code, city: data.city_id });
        if (host) qs.set("host", host);
        redirect(`/?${qs.toString()}`);
      }
    } catch (err) {
      // redirect() throws a control-flow signal — re-throw it untouched. Only a
      // genuine lookup failure falls through to the dead-link path below.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
        throw err;
      }
    }
  }

  // Unknown / inactive code, or attribution service unavailable → working form,
  // no attribution, no error.
  redirect("/?register=1");
}
