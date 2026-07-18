import { createAdminClient } from "@/lib/supabase/server";

// Admin score corrections read helper (service-role). There is no approval gate:
// a host's submission posts immediately (status submitted). Admins can edit a
// player's round score (status -> edited) or void the whole round (-> voided).
// Standings are computed on read, so any change reflects instantly.

export type AdminScorePlayer = {
  id: string;
  user_id: string;
  full_name: string | null;
  round_score: number;
  is_no_show: boolean;
  is_no_show_bonus: boolean;
};

export type AdminScoreSubmission = {
  id: string;
  status: string;
  created_at: string;
  week_number: number | null;
  table_date: string | null;
  location_name: string | null;
  city_name: string | null;
  series_name: string | null;
  players: AdminScorePlayer[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export async function getAdminSubmissions(): Promise<AdminScoreSubmission[]> {
  const admin: any = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("score_submissions")
    .select(
      "id, status, created_at, league_tables(week_number, table_date, location_name, cities(name), series(name)), score_submission_players(id, user_id, round_score, is_no_show, is_no_show_bonus, profiles(full_name))"
    )
    .order("created_at", { ascending: false });

  return ((data ?? []) as any[]).map((s) => {
    const table = one<any>(s.league_tables);
    const city = one<any>(table?.cities);
    const series = one<any>(table?.series);
    const players: AdminScorePlayer[] = ((s.score_submission_players ?? []) as any[])
      .map((p) => ({
        id: p.id,
        user_id: p.user_id,
        full_name: one<any>(p.profiles)?.full_name ?? null,
        round_score: p.round_score,
        is_no_show: p.is_no_show,
        is_no_show_bonus: p.is_no_show_bonus,
      }))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

    return {
      id: s.id,
      status: s.status,
      created_at: s.created_at,
      week_number: table?.week_number ?? null,
      table_date: table?.table_date ?? null,
      location_name: table?.location_name ?? null,
      city_name: city?.name ?? null,
      series_name: series?.name ?? null,
      players,
    };
  });
}
