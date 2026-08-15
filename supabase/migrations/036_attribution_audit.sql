-- ============================================================
-- THE MAHJONG OPEN — 036: attribution reassignment audit trail (Phase 2)
-- ============================================================
-- Records every manual change to a registration's attribution set, so a
-- reassignment (e.g. re-dividing the Memphis roster, or fixing a mistake) is
-- reversible-by-inspection. Stores the WHOLE prior + new attribution sets as
-- jsonb rather than single-field diffs, because a split change (2-way -> 3-way)
-- isn't one field moving.
--
-- Numbered 036 (035 was commissioner_referrals). Admin-only, service-role access
-- through /api/admin/registrations/[id]/attribution — RLS on, no policies, same
-- posture as commissioner_referral_codes / table_invites.
-- ============================================================

BEGIN;

CREATE TABLE public.attribution_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  changed_by_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  previous jsonb NOT NULL, -- full prior set of registration_attributions rows
  next jsonb NOT NULL,     -- full new set
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attribution_audit_registration_id_idx ON public.attribution_audit(registration_id);

ALTER TABLE public.attribution_audit ENABLE ROW LEVEL SECURITY;
-- No permissive policies: all reads/writes go through the admin-gated API route
-- on the service-role client.

COMMIT;
