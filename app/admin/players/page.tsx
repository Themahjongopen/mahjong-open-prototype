"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";

const PAID_BADGE: Record<string, string> = { paid: "badge-lime", pending: "badge-butter", refunded: "badge-mute" };

// "Demo — Portal Screenshots (not live)" series — the isolated demo roster kept
// long-term per portal-screenshots-mobile/. Excluded from the default "all series"
// view (headline counts, City dropdown, unfiltered table) so it doesn't pollute
// real registration numbers, but still LISTED and selectable in the Series
// dropdown — picking it there shows its rows normally, like any other series.
// NOTE: if a general `series.is_demo` flag is ever added (deferred per the
// 2026-08-01 admin-metrics decision), replace this hardcoded id with that flag.
const DEMO_SERIES_ID = "3ea14344-cc5e-4b6d-aaec-2eb143003c96";

type InviteState = "none" | "invited" | "active";

type RegistrationRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  skill_level: string | null;
  paid_status: string;
  created_at: string;
  city: string | null;
  city_id: string | null;
  series: string | null;
  series_id: string | null;
  paid_city_count: number;
  invited: boolean;
  invite_state: InviteState;
  profile_id?: string | null;
  role?: string | null;
};

type CityChoice = { city_id: string; label: string };

type Filter = "all" | "paid" | "pending";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Wrap a CSV field in quotes when it contains a comma, quote, or newline; escape embedded quotes.
function csvField(value: string | null): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function AdminRegistrationsPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState<string>("");
  // cityFilter / seriesFilter hold a city_id / series_id ("all" = no filter).
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const [multiCityOnly, setMultiCityOnly] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  // When promoting a player who has paid in more than one city, we ask which
  // city rather than guessing. This holds the pending promotion + its choices.
  const [cityPicker, setCityPicker] = useState<{ row: RegistrationRow; cities: CityChoice[] } | null>(null);
  const confirm = useConfirm();

  // Distinct paid cities for a profile, drawn from the already-loaded rows.
  function paidCitiesFor(profileId: string): CityChoice[] {
    const byCity = new Map<string, string>();
    for (const r of rows) {
      if (r.profile_id === profileId && r.paid_status === "paid" && r.city_id) {
        if (!byCity.has(r.city_id)) byCity.set(r.city_id, r.city ?? "Their city");
      }
    }
    return Array.from(byCity, ([city_id, label]) => ({ city_id, label }));
  }

  // Send the designation change. cityId is required for "commissioner".
  async function designate(row: RegistrationRow, designation: "commissioner" | "player", city?: CityChoice) {
    if (!row.profile_id) return;
    setRoleBusyId(row.id);
    setMessage(null);
    const response = await fetch("/api/admin/players", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: row.profile_id,
        designation,
        ...(designation === "commissioner" && city ? { cityId: city.city_id } : {}),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage(
        designation === "commissioner"
          ? `Commissioner updated${city ? ` for ${city.label}` : ""}.`
          : "Commissioner removed."
      );
      await loadRows();
    } else {
      setMessage(payload.error ?? "Could not update role.");
    }
    setRoleBusyId(null);
  }

  async function toggleCommissioner(row: RegistrationRow) {
    if (!row.profile_id) return;

    // Demote — no city needed.
    if (row.role === "commissioner") {
      const ok = await confirm({
        title: "Remove commissioner?",
        message: `Remove commissioner from ${row.full_name ?? row.email}?`,
        confirmLabel: "Remove",
        danger: true,
      });
      if (ok) await designate(row, "player");
      return;
    }

    // Promote — the commissioner leads a PAID city, so choose among those.
    const cities = paidCitiesFor(row.profile_id);
    if (cities.length === 0) {
      setMessage("This player has no paid registration yet, so they can't lead a city.");
      return;
    }
    if (cities.length > 1) {
      // Ambiguous — ask which city instead of guessing.
      setCityPicker({ row, cities });
      return;
    }
    // Exactly one paid city — keep the existing one-click confirm.
    const only = cities[0];
    const ok = await confirm({
      title: "Make commissioner?",
      message: `Make ${row.full_name ?? row.email} the commissioner for ${only.label}? This replaces the current commissioner there.`,
      confirmLabel: "Make commissioner",
    });
    if (ok) await designate(row, "commissioner", only);
  }

  // Instantly re-issue a pending registration's checkout link + reminder email.
  async function resendLink(row: RegistrationRow) {
    setResendBusyId(row.id);
    setResendMsg((m) => ({ ...m, [row.id]: "" }));
    try {
      const res = await fetch(`/api/admin/registrations/${row.id}/resend`, { method: "POST", credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendMsg((m) => ({ ...m, [row.id]: payload.emailSent ? "Reminder sent" : "Link created, but the email failed to send — check Resend" }));
      } else {
        setResendMsg((m) => ({ ...m, [row.id]: payload.error ?? "Could not resend the link." }));
      }
    } finally {
      setResendBusyId(null);
    }
  }

  async function loadRows() {
    setLoading(true);
    const response = await fetch("/api/admin/players", { credentials: "include" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setRows(Array.isArray(payload.players) ? payload.players : []);
      setMessage(null);
    } else {
      setMessage(payload.error ?? "Unable to load registrations.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

  // The demo series is hidden from the default view; it's only visible when the
  // admin explicitly picks it in the Series dropdown. Everything the "all series"
  // view summarizes (headline counts, City dropdown, unfiltered table) is derived
  // from `visibleRows` rather than raw `rows` so the demo roster stays out by
  // default and appears normally the moment its series is selected.
  const showingDemoSeries = seriesFilter === DEMO_SERIES_ID;
  const visibleRows = useMemo(
    () => (showingDemoSeries ? rows : rows.filter((r) => r.series_id !== DEMO_SERIES_ID)),
    [rows, showingDemoSeries]
  );

  const paidCount = useMemo(() => visibleRows.filter((r) => r.paid_status === "paid").length, [visibleRows]);

  // Paid registrants with no portal account yet — the target set for bulk invite.
  const uninvitedPaid = useMemo(
    () => visibleRows.filter((r) => r.paid_status === "paid" && r.invite_state === "none"),
    [visibleRows]
  );

  // Distinct (city_id, label) pairs present in the loaded rows, for the City
  // dropdown, each with paid/pending counts (refunded excluded). Counts are over
  // `visibleRows` (the demo series is excluded by default) — NOT filteredRows —
  // so they don't shift as the payment/city filters change, matching the old
  // label-keyed badge behavior. `allPaid` / `allPending` are the whole-visible
  // totals for the "All cities" option.
  const { cityOptions, allPaid, allPending } = useMemo(() => {
    const byId = new Map<string, { label: string; paid: number; pending: number }>();
    let allPaid = 0;
    let allPending = 0;
    for (const r of visibleRows) {
      if (r.paid_status === "paid") allPaid += 1;
      else if (r.paid_status === "pending") allPending += 1;
      if (!r.city_id) continue;
      const entry = byId.get(r.city_id) ?? { label: r.city ?? r.city_id, paid: 0, pending: 0 };
      if (r.paid_status === "paid") entry.paid += 1;
      else if (r.paid_status === "pending") entry.pending += 1;
      byId.set(r.city_id, entry);
    }
    const cityOptions = Array.from(byId, ([id, v]) => ({ id, ...v })).sort((a, b) => a.label.localeCompare(b.label));
    return { cityOptions, allPaid, allPending };
  }, [visibleRows]);

  // Distinct (series_id, name) pairs present in the loaded rows, for the Series
  // dropdown — matters once a second series' registration opens alongside the first.
  const seriesOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) if (r.series_id) byId.set(r.series_id, r.series ?? r.series_id);
    return Array.from(byId, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // All filters combine with AND: a row must match every active one to show.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleRows.filter((r) => {
      if (filter !== "all" && r.paid_status !== filter) return false;
      if (cityFilter !== "all" && r.city_id !== cityFilter) return false;
      if (seriesFilter !== "all" && r.series_id !== seriesFilter) return false;
      if (multiCityOnly && r.paid_city_count < 2) return false;
      if (q) {
        const hay = `${r.full_name ?? ""} ${r.email} ${r.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleRows, filter, search, cityFilter, seriesFilter, multiCityOnly]);

  function handleExport() {
    const header = ["Name", "Email", "Phone", "City", "Series", "Skill", "Payment status", "Registered date"];
    const lines = [header.join(",")];
    for (const r of filteredRows) {
      lines.push([
        csvField(r.full_name),
        csvField(r.email),
        csvField(r.phone),
        csvField(r.city),
        csvField(r.series),
        csvField(r.skill_level),
        csvField(r.paid_status),
        csvField(formatDate(r.created_at)),
      ].join(","));
    }
    const csv = lines.join("\r\n");
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `registrations-${today}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  // Single, resend, and bulk invites all POST the same endpoint with an id array.
  async function postInvites(registrationIds: string[]): Promise<{ ok: boolean; payload: any }> {
    const response = await fetch("/api/admin/invite", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationIds }),
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, payload };
  }

  async function handleRowInvite(row: RegistrationRow, resend: boolean) {
    const confirmed = await confirm({
      title: resend ? "Re-send invite?" : "Send invite?",
      message: `${resend ? "Re-send the portal invite to" : "Send a portal invite to"} ${row.full_name ?? row.email} (${row.email})?`,
      confirmLabel: resend ? "Re-send" : "Send invite",
    });
    if (!confirmed) return;
    setBusyId(row.id);
    setMessage(null);
    const { ok, payload } = await postInvites([row.id]);
    if (ok) {
      setMessage(`${resend ? "Invite re-sent" : "Invite sent"} to ${row.email}.`);
      await loadRows();
    } else {
      setMessage(payload.error ?? "Unable to send invite.");
    }
    setBusyId(null);
  }

  async function handleBulkInvite() {
    const targets = uninvitedPaid;
    if (targets.length === 0) return;
    const confirmed = await confirm({
      title: "Send invites?",
      message: `Send a portal invite to ${targets.length} paid ${targets.length === 1 ? "player" : "players"} who haven't been invited yet?`,
      confirmLabel: `Invite ${targets.length}`,
    });
    if (!confirmed) return;
    setBulkBusy(true);
    setMessage(null);
    const { ok, payload } = await postInvites(targets.map((r) => r.id));
    if (ok || typeof payload.sent === "number") {
      const parts = [`Invited ${payload.sent ?? 0}`];
      if (payload.skipped) parts.push(`${payload.skipped} skipped`);
      if (payload.failed) parts.push(`${payload.failed} failed`);
      setMessage(`${parts.join(" · ")}.`);
      await loadRows();
    } else {
      setMessage(payload.error ?? "Unable to send invites.");
    }
    setBulkBusy(false);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "paid", label: "Paid" },
    { key: "pending", label: "Pending" },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 8 }}>Registrations</h1>
          <p style={{ fontSize: 15, color: "var(--ink-500)" }}>{paidCount} paid · {visibleRows.length} total</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleBulkInvite}
            disabled={bulkBusy || uninvitedPaid.length === 0}
          >
            {bulkBusy ? "Inviting…" : `Invite ${uninvitedPaid.length} paid ${uninvitedPaid.length === 1 ? "player" : "players"}`}
          </button>
          <button type="button" className="btn" onClick={handleExport} disabled={filteredRows.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {message ? <p style={{ fontSize: 13, color: "var(--ink-700)", marginBottom: 16 }}>{message}</p> : null}

      {/* Search */}
      <div style={{ margin: "16px 0 12px" }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or phone…"
          aria-label="Search registrations"
          className="input-mo"
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* Payment status + multi-city toggle (same badge-button pattern) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`badge ${filter === f.key ? "badge-lime" : "badge-mute"}`}
            style={{ cursor: "pointer", border: "1px solid var(--hair-200)", background: filter === f.key ? undefined : "#fff" }}
          >
            {f.label}
          </button>
        ))}
        <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: "var(--hair-200)", margin: "0 4px" }} />
        <button
          type="button"
          onClick={() => setMultiCityOnly((v) => !v)}
          aria-pressed={multiCityOnly}
          className={`badge ${multiCityOnly ? "badge-pink" : "badge-mute"}`}
          style={{ cursor: "pointer", border: "1px solid var(--hair-200)", background: multiCityOnly ? undefined : "#fff" }}
        >
          Registered in multiple cities
        </button>
      </div>

      {/* City + series dropdowns */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <select aria-label="Filter by city" className="input-mo" style={{ maxWidth: 320 }} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="all">All cities — {allPaid} paid, {allPending} pending</option>
          {cityOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.label} — {c.paid} paid, {c.pending} pending</option>
          ))}
        </select>
        <select aria-label="Filter by series" className="input-mo" style={{ maxWidth: 340 }} value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}>
          <option value="all">All series</option>
          {seriesOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        <div className="admin-players-table">
          <div className="admin-players-table-header">
            {["Name", "Email", "Phone", "City", "Series", "Skill", "Payment", "Registered", "Portal"].map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 20, color: "var(--ink-500)" }}>Loading registrations…</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: 20, color: "var(--ink-500)" }}>
              {rows.length === 0 ? "No registrations yet." : "No registrations match this filter."}
            </div>
          ) : (
            filteredRows.map((r) => (
              <div key={r.id} className="admin-players-row">
                <div>
                  <span className="admin-mobile-label">Name</span>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)" }}>{r.full_name ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Email</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)", wordBreak: "break-word" }}>{r.email}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Phone</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.phone ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">City</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.city ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Series</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.series ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Skill</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)", textTransform: "capitalize" }}>{r.skill_level ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Payment</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className={`badge ${PAID_BADGE[r.paid_status] ?? "badge-mute"}`} style={{ alignSelf: "center" }}>{r.paid_status}</span>
                    {r.paid_status === "pending" ? (
                      <>
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: 12, padding: "5px 11px" }}
                          disabled={resendBusyId === r.id}
                          onClick={() => resendLink(r)}
                          title="Send a fresh checkout link + reminder email"
                        >
                          {resendBusyId === r.id ? "Sending…" : "Resend link"}
                        </button>
                        {resendMsg[r.id] ? <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{resendMsg[r.id]}</span> : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <div>
                  <span className="admin-mobile-label">Registered</span>
                  <p style={{ fontSize: 12, color: "var(--ink-500)" }}>{formatDate(r.created_at)}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Portal</span>
                  {r.invite_state === "active" ? (
                    <span className="badge badge-lime" style={{ alignSelf: "center" }} title="Signed in — direct them to “Forgot password” to reset.">Active</span>
                  ) : r.invite_state === "invited" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="badge badge-butter">Invited</span>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 12, padding: "5px 11px" }}
                        disabled={busyId === r.id}
                        onClick={() => handleRowInvite(r, true)}
                      >
                        {busyId === r.id ? "Sending…" : "Resend"}
                      </button>
                    </div>
                  ) : r.paid_status === "paid" ? (
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 12, padding: "6px 12px" }}
                      disabled={busyId === r.id}
                      onClick={() => handleRowInvite(r, false)}
                    >
                      {busyId === r.id ? "Sending…" : "Invite"}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>—</span>
                  )}
                  {r.profile_id ? (
                    r.role === "commissioner" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <span className="badge badge-pink" style={{ fontSize: 11 }}>Commissioner</span>
                        <button type="button" className="btn" style={{ fontSize: 11, padding: "3px 9px" }} disabled={roleBusyId === r.id} onClick={() => toggleCommissioner(r)}>
                          {roleBusyId === r.id ? "…" : "Remove"}
                        </button>
                      </div>
                    ) : r.role === "admin" ? (
                      <span className="badge badge-mute" style={{ fontSize: 11, marginTop: 6, alignSelf: "flex-start" }}>Admin</span>
                    ) : (
                      <button type="button" className="btn" style={{ fontSize: 11, padding: "3px 9px", marginTop: 6 }} disabled={roleBusyId === r.id} onClick={() => toggleCommissioner(r)}>
                        {roleBusyId === r.id ? "…" : "Make commissioner"}
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {cityPicker ? (
        <div
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setCityPicker(null); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "var(--overlay-scrim, rgba(20,20,20,0.45))",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a city"
            style={{
              background: "#fff",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-lg)",
              width: "100%",
              maxWidth: 400,
              padding: "28px 28px 24px",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--ink-900)", margin: "0 0 10px" }}>
              Which city?
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-700)", margin: "0 0 20px" }}>
              {cityPicker.row.full_name ?? cityPicker.row.email} is registered in more than one city. Pick the city they’ll be commissioner of — this replaces the current commissioner there.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {cityPicker.cities.map((c) => (
                <button
                  key={c.city_id}
                  type="button"
                  className="btn"
                  style={{ justifyContent: "flex-start", padding: "12px 16px", textAlign: "left" }}
                  onClick={() => {
                    const { row } = cityPicker;
                    setCityPicker(null);
                    void designate(row, "commissioner", c);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setCityPicker(null)} style={{ justifyContent: "center", padding: "11px 20px" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
