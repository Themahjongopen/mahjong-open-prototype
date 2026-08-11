"use client";

import type { CommissionerCity } from "@/lib/portal/commissionerCity";

// City switcher shown in the commissioner header only when a commissioner leads
// more than one city (same ">1" rule as the player/admin switchers). Setting the
// cookie + full reload is deliberate: the roster page fetches its rows
// client-side from /api/commissioner/players (which scopes to the active city on
// the server), so a plain router.refresh() wouldn't re-run that fetch — a reload
// guarantees the new city's roster loads with no stale cross-city rows.
//
// Cookie name mirrors COMMISSIONER_CITY_COOKIE in lib/portal/commissionerCity.ts
// (kept as a literal here because that module imports next/headers and can't be
// pulled into a client component).
const COMMISSIONER_CITY_COOKIE = "commissioner_active_city";

export default function CommissionerCitySwitcher({
  cities,
  activeCityId,
}: {
  cities: CommissionerCity[];
  activeCityId: string | null;
}) {
  function onChange(cityId: string) {
    document.cookie = `${COMMISSIONER_CITY_COOKIE}=${cityId}; path=/; max-age=31536000`;
    window.location.reload();
  }

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-500)" }}>Viewing</span>
      <select
        className="input-mo"
        style={{ fontSize: 13, padding: "8px 12px", minWidth: 160 }}
        value={activeCityId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Switch city"
      >
        {cities.map((c) => (
          <option key={c.city_id} value={c.city_id}>{c.city_name ?? "Your city"}</option>
        ))}
      </select>
    </label>
  );
}
