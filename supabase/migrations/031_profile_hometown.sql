-- ============================================================
-- THE MAHJONG OPEN — profiles.hometown (player-entered)
-- ============================================================
-- Additive, low-risk single-column add (same shape as migration 010's
-- skill_level). A player's actual hometown, separate from their registered
-- league city/region — motivated by multi-county regions like East Alabama
-- where "the city you registered under" isn't where a player is from. Displayed
-- to their commissioner on the roster; never filtered/sorted on, so no index.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hometown text;
