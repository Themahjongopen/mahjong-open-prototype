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
  invite_sent_at: string | null;
  reminder_sent_at: string | null;
  profile_id?: string | null;
  role?: string | null;
  // Every city this profile leads (migration 029). The "Commissioner" badge +
  // Remove show only on rows whose city_id is in this list.
  commissioner_city_ids?: string[];
  // Revenue attribution (migration 035). Empty = no attribution row yet.
  attribution: Array<{ commissioner_profile_id: string | null; commissioner_name: string | null; weight: number }>;
  attribution_source: string | null;
};

type CityChoice = { city_id: string; label: string };

type Filter = "all" | "paid" | "pending";
type SourceFilter = "all" | "link" | "dropdown" | "organic_split" | "backfill" | "manual" | "none";
type Commissioner = { profile_id: string; full_name: string };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Date + time, e.g. "Aug 6, 2:14 PM" — for the "Sent {…}" invite note.
function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
  const [invitedNoAccountOnly, setInvitedNoAccountOnly] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<Record<string, string>>({});
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [refundMsg, setRefundMsg] = useState<Record<string, string>>({});
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<Record<string, string>>({});
  const [copyBusyId, setCopyBusyId] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResendBusy, setBulkResendBusy] = useState(false);
  // Checkbox selection for the selective bulk actions.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedInviteBusy, setSelectedInviteBusy] = useState(false);
  const [selectedResendBusy, setSelectedResendBusy] = useState(false);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  // Inline per-row edit of name/email/phone (only one row edits at a time).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ full_name: string; email: string; phone: string }>({ full_name: "", email: "", phone: "" });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string>("");

  // Source filter (Shari pulls the organic_split rows to show commissioners).
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  // Attribution reassignment modal.
  const [attrRow, setAttrRow] = useState<RegistrationRow | null>(null);
  const [attrOptions, setAttrOptions] = useState<Commissioner[]>([]);
  const [attrEntries, setAttrEntries] = useState<Array<{ commissioner_profile_id: string | null; weight: string }>>([]);
  const [attrBusy, setAttrBusy] = useState(false);
  const [attrError, setAttrError] = useState<string>("");

  async function openAttr(r: RegistrationRow) {
    setAttrRow(r);
    setAttrError("");
    setAttrOptions([]);
    // Seed from the current set, or one blank entry.
    setAttrEntries(
      r.attribution.length
        ? r.attribution.map((a) => ({ commissioner_profile_id: a.commissioner_profile_id, weight: a.weight.toFixed(4) }))
        : [{ commissioner_profile_id: null, weight: "1.0000" }]
    );
    if (r.city_id) {
      const res = await fetch(`/api/commissioners?city_id=${encodeURIComponent(r.city_id)}`);
      const payload = await res.json().catch(() => ({}));
      setAttrOptions((payload.commissioners ?? []) as Commissioner[]);
    }
  }

  function evenSplit() {
    setAttrEntries((entries) => {
      const n = entries.length;
      if (n === 0) return entries;
      const base = Math.floor((1 / n) * 10000) / 10000;
      return entries.map((e, i) => ({ ...e, weight: (i === 0 ? 1 - base * (n - 1) : base).toFixed(4) }));
    });
  }

  async function saveAttr() {
    if (!attrRow) return;
    const attributions = attrEntries.map((e) => ({ commissioner_profile_id: e.commissioner_profile_id, weight: Number(e.weight) }));
    const sum = attributions.reduce((s, a) => s + (Number.isFinite(a.weight) ? a.weight : 0), 0);
    if (Math.abs(sum - 1) > 0.001) {
      setAttrError(`Weights must sum to 1.0 (they sum to ${sum.toFixed(4)}).`);
      return;
    }
    setAttrBusy(true);
    setAttrError("");
    try {
      const res = await fetch(`/api/admin/registrations/${attrRow.id}/attribution`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributions }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttrError(payload.error || "Could not save attribution.");
        return;
      }
      setAttrRow(null);
      await loadRows();
    } finally {
      setAttrBusy(false);
    }
  }
  // When promoting a player who has paid in more than one city, we ask which
  // city rather than guessing. This holds the pending promotion + its choices.
  const confirm = useConfirm();

  // Send the designation change. Both promote and demote are city-scoped now
  // (migration 029), so cityId travels with either — the row IS a specific city.
  async function designate(row: RegistrationRow, designation: "commissioner" | "player", city: CityChoice) {
    if (!row.profile_id) return;
    setRoleBusyId(row.id);
    setMessage(null);
    const response = await fetch("/api/admin/players", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: row.profile_id, designation, cityId: city.city_id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage(
        designation === "commissioner"
          ? `Commissioner added for ${city.label}.`
          : `Commissioner removed for ${city.label}.`
      );
      await loadRows();
    } else {
      setMessage(payload.error ?? "Could not update role.");
    }
    setRoleBusyId(null);
  }

  // Promote/demote for THIS row's own city — each row is one (profile, city), so
  // there's nothing to disambiguate. Leading a city is set membership now, so the
  // branch keys off whether this row's city is in the profile's led set (NOT the
  // profile-wide role, which stays 'commissioner' while they lead any city).
  async function toggleCommissioner(row: RegistrationRow) {
    if (!row.profile_id || !row.city_id) return;
    const city: CityChoice = { city_id: row.city_id, label: row.city ?? "this city" };
    const leadsThisCity = row.commissioner_city_ids?.includes(row.city_id) ?? false;

    if (leadsThisCity) {
      const ok = await confirm({
        title: "Remove commissioner?",
        message: `Remove ${row.full_name ?? row.email} as commissioner of ${city.label}?`,
        confirmLabel: "Remove",
        danger: true,
      });
      if (ok) await designate(row, "player", city);
      return;
    }

    // Promote for this city — they must hold a paid registration in it.
    if (row.paid_status !== "paid") {
      setMessage("This player hasn't paid for this city yet, so they can't lead it.");
      return;
    }
    const ok = await confirm({
      title: "Make commissioner?",
      message: `Make ${row.full_name ?? row.email} a commissioner of ${city.label}?`,
      confirmLabel: "Make commissioner",
    });
    if (ok) await designate(row, "commissioner", city);
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

  // Mark a paid registration as refunded. Confirms first — this is a one-way
  // action in the UI (no "undo" button); does NOT call Stripe, just syncs the
  // DB status. See the refund route's comment for the full rationale.
  async function markRefunded(row: RegistrationRow) {
    const ok = await confirm({
      title: "Mark as refunded?",
      message: `Mark ${row.full_name ?? row.email}'s registration as refunded? This removes them from standings, the directory, and their city roster. This does NOT process a Stripe refund — only do this after refunding them in Stripe.`,
      confirmLabel: "Mark refunded",
      danger: true,
    });
    if (!ok) return;

    setRefundBusyId(row.id);
    setRefundMsg((m) => ({ ...m, [row.id]: "" }));
    try {
      const res = await fetch(`/api/admin/registrations/${row.id}/refund`, { method: "POST", credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadRows(); // refetch so the badge + counts reflect the new status
      } else {
        setRefundMsg((m) => ({ ...m, [row.id]: payload.error ?? "Could not mark this registration refunded." }));
      }
    } finally {
      setRefundBusyId(null);
    }
  }

  // Permanently delete a PENDING registration — for cleaning up duplicate/
  // abandoned entries. Confirms first (this can't be undone). Only pending rows
  // offer this button; the API also enforces pending-only as a safety rail.
  async function deleteRegistration(row: RegistrationRow) {
    const ok = await confirm({
      title: "Delete this registration?",
      message: `Permanently delete ${row.full_name ?? row.email}'s pending registration for ${row.city ?? "this city"}? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    setDeleteBusyId(row.id);
    setDeleteMsg((m) => ({ ...m, [row.id]: "" }));
    try {
      const res = await fetch(`/api/admin/registrations/${row.id}`, { method: "DELETE", credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadRows(); // refetch so the deleted row + counts disappear
      } else {
        setDeleteMsg((m) => ({ ...m, [row.id]: payload.error ?? "Could not delete the registration." }));
      }
    } finally {
      setDeleteBusyId(null);
    }
  }

  function startEdit(row: RegistrationRow) {
    setEditingId(row.id);
    setEditForm({ full_name: row.full_name ?? "", email: row.email, phone: row.phone ?? "" });
    setEditError("");
  }
  function cancelEdit() {
    setEditingId(null);
    setEditError("");
  }
  // Save name/email/phone via the PATCH route. Errors show inline on the row
  // (like resendMsg); success reloads the table so the derived state (invite
  // state, counts, etc.) reflects the new values.
  async function saveEdit(row: RegistrationRow) {
    setEditBusy(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/registrations/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: editForm.full_name.trim(), email: editForm.email.trim(), phone: editForm.phone.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingId(null);
        setMessage(`Updated ${editForm.full_name.trim() || editForm.email.trim()}.`);
        await loadRows();
      } else {
        setEditError(payload.error ?? "Could not save changes.");
      }
    } finally {
      setEditBusy(false);
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

  // Paid registrants who were invited but have never signed in — the target set
  // for bulk resend (distinct from uninvitedPaid, which is invite_state "none").
  const pendingInvited = useMemo(
    () => visibleRows.filter((r) => r.paid_status === "paid" && r.invite_state === "invited"),
    [visibleRows]
  );

  // profile_id -> labels of ALL cities that profile leads (a profile may now lead
  // more than one, migration 029). Used so a multi-city commissioner's OTHER rows
  // can say "Commissioner in {A, B}" instead of showing the badge on a city they
  // don't actually lead. Labels are drawn from each led city's own row.
  const commissionerCitiesByProfileId = useMemo(() => {
    const map = new Map<string, Map<string, string>>(); // profile_id -> (city_id -> label)
    for (const r of rows) {
      if (r.profile_id && r.city_id && (r.commissioner_city_ids?.includes(r.city_id) ?? false)) {
        const inner = map.get(r.profile_id) ?? new Map<string, string>();
        inner.set(r.city_id, r.city ?? "a city");
        map.set(r.profile_id, inner);
      }
    }
    return map;
  }, [rows]);

  // The led-city labels for a profile EXCEPT the given city (for the "Commissioner
  // in …" note shown on a row whose own city they don't lead).
  function ledCitiesExcept(profileId: string, exceptCityId: string | null): string[] {
    const inner = commissionerCitiesByProfileId.get(profileId);
    if (!inner) return [];
    return Array.from(inner.entries()).filter(([id]) => id !== exceptCityId).map(([, label]) => label);
  }

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
      if (invitedNoAccountOnly && !(r.paid_status === "paid" && r.invite_state === "invited")) return false;
      if (sourceFilter !== "all") {
        if (sourceFilter === "none" ? r.attribution_source !== null : r.attribution_source !== sourceFilter) return false;
      }
      if (q) {
        const hay = `${r.full_name ?? ""} ${r.email} ${r.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleRows, filter, search, cityFilter, seriesFilter, multiCityOnly, invitedNoAccountOnly, sourceFilter]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // "Select all visible" reflects/affects only the currently filtered rows —
  // selections outside the current filter are left untouched, so filtering
  // down, selecting, then widening the filter again doesn't lose a partial pick.
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));
  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of filteredRows) next.delete(r.id);
      } else {
        for (const r of filteredRows) next.add(r.id);
      }
      return next;
    });
  }

  // Selection is intentionally NOT cleared by changing filters/search — the
  // whole point is picking specific rows while scrolling/filtering through a
  // long list. It IS cleared after a selection-based send succeeds (below), and
  // via the explicit "Clear selection" control.
  const selectedInvited = useMemo(
    () => visibleRows.filter((r) => selectedIds.has(r.id) && r.invite_state === "invited"),
    [visibleRows, selectedIds]
  );
  const selectedPendingPayment = useMemo(
    () => visibleRows.filter((r) => selectedIds.has(r.id) && r.paid_status === "pending"),
    [visibleRows, selectedIds]
  );

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

  // Generate the player's portal set-password link and copy it to the clipboard —
  // a last-resort path when their invite email won't arrive. On clipboard failure
  // (older browsers / blocked permission) the raw URL is stored in copyMsg and
  // rendered as selectable text below so it can still be copied by hand.
  async function handleCopyInviteLink(row: RegistrationRow) {
    setCopyBusyId(row.id);
    setCopyMsg((m) => ({ ...m, [row.id]: "" }));
    try {
      const res = await fetch(`/api/admin/registrations/${row.id}/invite-link`, { method: "POST", credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.actionUrl) {
        try {
          await navigator.clipboard.writeText(payload.actionUrl);
          setCopyMsg((m) => ({ ...m, [row.id]: "Link copied — expires in 24 hours" }));
        } catch {
          setCopyMsg((m) => ({ ...m, [row.id]: payload.actionUrl }));
        }
      } else {
        setCopyMsg((m) => ({ ...m, [row.id]: payload.error ?? "Could not generate a link." }));
      }
    } finally {
      setCopyBusyId(null);
    }
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

  // Bulk resend to already-invited-but-not-signed-in players. Same /api/admin/invite
  // pipeline as handleBulkInvite (the invite→recovery fallback re-sends a fresh
  // set-password link to an existing unconfirmed account — no duplicate accounts),
  // just targeting pendingInvited, with its own busy flag so the two bulk buttons
  // don't block each other.
  async function handleBulkResend() {
    const targets = pendingInvited;
    if (targets.length === 0) return;
    const confirmed = await confirm({
      title: "Re-send invites?",
      message: `Re-send the portal invite to ${targets.length} ${targets.length === 1 ? "player" : "players"} who haven't set up their account yet?`,
      confirmLabel: `Re-send ${targets.length}`,
    });
    if (!confirmed) return;
    setBulkResendBusy(true);
    setMessage(null);
    const { ok, payload } = await postInvites(targets.map((r) => r.id));
    if (ok || typeof payload.sent === "number") {
      const parts = [`Re-sent ${payload.sent ?? 0}`];
      if (payload.skipped) parts.push(`${payload.skipped} skipped`);
      if (payload.failed) parts.push(`${payload.failed} failed`);
      setMessage(`${parts.join(" · ")}.`);
      await loadRows();
    } else {
      setMessage(payload.error ?? "Unable to re-send invites.");
    }
    setBulkResendBusy(false);
  }

  // Selective version of the "Resend setup link" bulk action — same /api/admin/invite
  // pipeline, just targeting whichever selected rows are actually invite_state
  // "invited" rather than the whole pendingInvited set.
  async function handleSelectedInvite() {
    const targets = selectedInvited;
    if (targets.length === 0) return;
    const confirmed = await confirm({
      title: "Resend setup link?",
      message: `Resend the portal setup email to ${targets.length} selected ${targets.length === 1 ? "player" : "players"} who haven't signed in yet?`,
      confirmLabel: `Resend to ${targets.length}`,
    });
    if (!confirmed) return;
    setSelectedInviteBusy(true);
    setMessage(null);
    const { ok, payload } = await postInvites(targets.map((r) => r.id));
    if (ok || typeof payload.sent === "number") {
      const parts = [`Re-sent ${payload.sent ?? 0}`];
      if (payload.skipped) parts.push(`${payload.skipped} skipped`);
      if (payload.failed) parts.push(`${payload.failed} failed`);
      setMessage(`${parts.join(" · ")}.`);
      setSelectedIds(new Set());
      await loadRows();
    } else {
      setMessage(payload.error ?? "Unable to resend.");
    }
    setSelectedInviteBusy(false);
  }

  // Selective bulk resend of the "complete your registration" email, for
  // selected rows with paid_status === "pending". New endpoint — no bulk version
  // of this one existed before this build.
  async function handleSelectedRegistrationResend() {
    const targets = selectedPendingPayment;
    if (targets.length === 0) return;
    const confirmed = await confirm({
      title: "Resend registration link?",
      message: `Resend the "complete your registration" email to ${targets.length} selected ${targets.length === 1 ? "player" : "players"}?`,
      confirmLabel: `Resend to ${targets.length}`,
    });
    if (!confirmed) return;
    setSelectedResendBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/registrations/resend-bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: targets.map((r) => r.id) }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const parts = [`Sent ${payload.sent ?? 0}`];
      if (payload.skipped) parts.push(`${payload.skipped} skipped`);
      if (payload.failed) parts.push(`${payload.failed} failed`);
      setMessage(`${parts.join(" · ")}.`);
      setSelectedIds(new Set());
      await loadRows();
    } else {
      setMessage(payload.error ?? "Unable to resend.");
    }
    setSelectedResendBusy(false);
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
          <p style={{ fontSize: 15, color: "var(--ink-500)" }}>
            {paidCount} paid · {visibleRows.length} total
            {loading && rows.length > 0 ? <span style={{ marginLeft: 8, fontSize: 12, color: "var(--mute-400)" }}>Refreshing…</span> : null}
          </p>
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
          <button
            type="button"
            className="btn"
            onClick={handleBulkResend}
            disabled={bulkResendBusy || pendingInvited.length === 0}
            title="Re-sends the portal account setup email to paid players who haven't signed in yet. Not related to payment status."
          >
            {bulkResendBusy ? "Resending…" : `Resend setup link to ${pendingInvited.length} not signed in`}
          </button>
          <button type="button" className="btn" onClick={handleExport} disabled={filteredRows.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--paper-100)", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-700)" }}>{selectedIds.size} selected</span>
          <button type="button" className="btn" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 12, padding: "6px 12px" }}
            disabled={selectedInviteBusy || selectedInvited.length === 0}
            onClick={handleSelectedInvite}
            title="Only affects selected rows that haven't signed in yet"
          >
            {selectedInviteBusy ? "Resending…" : `Resend setup link to ${selectedInvited.length} selected`}
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 12, padding: "6px 12px" }}
            disabled={selectedResendBusy || selectedPendingPayment.length === 0}
            onClick={handleSelectedRegistrationResend}
            title="Only affects selected rows still pending payment"
          >
            {selectedResendBusy ? "Resending…" : `Resend registration link to ${selectedPendingPayment.length} selected`}
          </button>
        </div>
      ) : null}

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
        <button
          type="button"
          onClick={() => setInvitedNoAccountOnly((v) => !v)}
          aria-pressed={invitedNoAccountOnly}
          className={`badge ${invitedNoAccountOnly ? "badge-pink" : "badge-mute"}`}
          style={{ cursor: "pointer", border: "1px solid var(--hair-200)", background: invitedNoAccountOnly ? undefined : "#fff" }}
          title="Paid, invited to the portal, but hasn't signed in yet"
        >
          Invited — no account yet
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
        <select aria-label="Filter by attribution source" className="input-mo" style={{ maxWidth: 240 }} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}>
          <option value="all">All attribution</option>
          <option value="organic_split">Organic (no one specific)</option>
          <option value="link">Referral link</option>
          <option value="dropdown">Dropdown pick</option>
          <option value="manual">Manually set</option>
          <option value="backfill">Backfilled</option>
          <option value="none">No attribution yet</option>
        </select>
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        <div className="admin-players-table">
          <div className="admin-players-table-header">
            <p>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                aria-label="Select all visible rows"
              />
            </p>
            {["Name", "Email", "Phone", "City", "Series", "Skill", "Payment", "Registered", "Portal", "Attribution"].map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
          {loading && rows.length === 0 ? (
            <div style={{ padding: 20, color: "var(--ink-500)" }}>Loading registrations…</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: 20, color: "var(--ink-500)" }}>
              {rows.length === 0 ? "No registrations yet." : "No registrations match this filter."}
            </div>
          ) : (
            filteredRows.map((r) => (
              <div key={r.id} className="admin-players-row">
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelected(r.id)}
                      aria-label={`Select ${r.full_name ?? r.email}`}
                    />
                    <span className="admin-mobile-label" style={{ marginBottom: 0 }}>Select</span>
                  </label>
                </div>
                <div>
                  <span className="admin-mobile-label">Name</span>
                  {editingId === r.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input
                        className="input-mo"
                        style={{ fontSize: 13, padding: "6px 8px", width: "100%" }}
                        value={editForm.full_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                        placeholder="Full name"
                        aria-label="Full name"
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: "5px 11px" }} disabled={editBusy} onClick={() => saveEdit(r)}>
                          {editBusy ? "Saving…" : "Save"}
                        </button>
                        <button type="button" className="btn" style={{ fontSize: 12, padding: "5px 11px" }} disabled={editBusy} onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                      {editError ? <span style={{ fontSize: 12, color: "var(--danger)" }}>{editError}</span> : null}
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)" }}>{r.full_name ?? "—"}</p>
                      <button type="button" className="btn" style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => startEdit(r)}>
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <span className="admin-mobile-label">Email</span>
                  {editingId === r.id ? (
                    <input
                      className="input-mo"
                      type="email"
                      style={{ fontSize: 13, padding: "6px 8px", width: "100%" }}
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      aria-label="Email"
                    />
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--ink-700)", wordBreak: "break-word" }}>{r.email}</p>
                  )}
                </div>
                <div>
                  <span className="admin-mobile-label">Phone</span>
                  {editingId === r.id ? (
                    <input
                      className="input-mo"
                      style={{ fontSize: 13, padding: "6px 8px", width: "100%" }}
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone"
                      aria-label="Phone"
                    />
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.phone ?? "—"}</p>
                  )}
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
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: 12, padding: "5px 11px", color: "var(--danger)" }}
                          disabled={deleteBusyId === r.id}
                          onClick={() => deleteRegistration(r)}
                          title="Permanently delete this pending registration — for cleaning up duplicates"
                        >
                          {deleteBusyId === r.id ? "Deleting…" : "Delete"}
                        </button>
                        {deleteMsg[r.id] ? <span style={{ fontSize: 12, color: "var(--danger)" }}>{deleteMsg[r.id]}</span> : null}
                        {r.reminder_sent_at ? (
                          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                            Reminder sent {formatDateTime(r.reminder_sent_at)}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    {r.paid_status === "paid" ? (
                      <>
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: 12, padding: "5px 11px" }}
                          disabled={refundBusyId === r.id}
                          onClick={() => markRefunded(r)}
                          title="Mark this registration refunded — does not process a Stripe refund, only syncs status"
                        >
                          {refundBusyId === r.id ? "Updating…" : "Mark refunded"}
                        </button>
                        {refundMsg[r.id] ? <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{refundMsg[r.id]}</span> : null}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="badge badge-lime" style={{ alignSelf: "center" }}>Active</span>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 12, padding: "5px 11px" }}
                        disabled={busyId === r.id}
                        onClick={() => handleRowInvite(r, true)}
                        title="Sends a fresh password-reset link — same as self-serve Forgot Password."
                      >
                        {busyId === r.id ? "Sending…" : "Send password reset"}
                      </button>
                      {r.invite_sent_at ? (
                        <span style={{ fontSize: 11, color: "var(--ink-500)" }}>
                          Sent {formatDateTime(r.invite_sent_at)}
                        </span>
                      ) : null}
                    </div>
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
                      {r.invite_sent_at ? (
                        <span style={{ fontSize: 11, color: "var(--ink-500)" }}>
                          Sent {formatDateTime(r.invite_sent_at)}
                        </span>
                      ) : null}
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
                  {/* Copy-link fallback for the bounced-email problem — paid rows only,
                      not "active" (they already have a password; a set-password link
                      isn't the right tool). Same guard as Invite/Resend. */}
                  {r.paid_status === "paid" && r.invite_state !== "active" ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, marginTop: 6 }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 12, padding: "5px 11px" }}
                        disabled={copyBusyId === r.id}
                        onClick={() => handleCopyInviteLink(r)}
                        title="Generate a set-password link and copy it — hand it to the player directly if their email won't arrive."
                      >
                        {copyBusyId === r.id ? "Generating…" : "Copy link"}
                      </button>
                      {copyMsg[r.id] ? (
                        copyMsg[r.id].startsWith("http") ? (
                          <input
                            type="text"
                            readOnly
                            value={copyMsg[r.id]}
                            onFocus={(e) => e.currentTarget.select()}
                            aria-label="Set-password link"
                            style={{ fontSize: 11, padding: "4px 6px", width: "100%", maxWidth: 280, border: "1px solid var(--hair-200)", borderRadius: 6, color: "var(--ink-700)" }}
                          />
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--ink-500)" }}>{copyMsg[r.id]}</span>
                        )
                      ) : null}
                      <span style={{ fontSize: 10, color: "var(--ink-500)", lineHeight: 1.4, maxWidth: 280 }}>
                        Paste directly to the player — anyone with this link can set their password.
                      </span>
                    </div>
                  ) : null}
                  {r.profile_id ? (
                    r.city_id && (r.commissioner_city_ids?.includes(r.city_id) ?? false) ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <span className="badge badge-pink" style={{ fontSize: 11 }}>Commissioner</span>
                        <button type="button" className="btn" style={{ fontSize: 11, padding: "3px 9px" }} disabled={roleBusyId === r.id} onClick={() => toggleCommissioner(r)}>
                          {roleBusyId === r.id ? "…" : "Remove"}
                        </button>
                      </div>
                    ) : r.role === "admin" ? (
                      <span className="badge badge-mute" style={{ fontSize: 11, marginTop: 6, alignSelf: "flex-start" }}>Admin</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, marginTop: 6 }}>
                        {(() => {
                          const otherLed = ledCitiesExcept(r.profile_id!, r.city_id ?? null);
                          return otherLed.length > 0 ? (
                            <span style={{ fontSize: 11, color: "var(--ink-500)" }}>
                              Commissioner in {otherLed.join(", ")}
                            </span>
                          ) : null;
                        })()}
                        <button type="button" className="btn" style={{ fontSize: 11, padding: "3px 9px" }} disabled={roleBusyId === r.id} onClick={() => toggleCommissioner(r)}>
                          {roleBusyId === r.id ? "…" : "Make commissioner"}
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
                <div>
                  <span className="admin-mobile-label">Attribution</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    {r.attribution.length === 0 ? (
                      <span style={{ fontSize: 13, color: "var(--ink-400)" }}>None</span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: "var(--ink-700)" }}>
                        {r.attribution.map((a, i) => (
                          <span key={i}>
                            {i > 0 ? " · " : ""}
                            {a.commissioner_name ?? "Unattributed"}
                            {r.attribution.length > 1 ? ` ${Math.round(a.weight * 100)}%` : ""}
                          </span>
                        ))}
                      </span>
                    )}
                    <button type="button" className="btn" style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => openAttr(r)}>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {attrRow ? (
        <div role="dialog" aria-modal="true" aria-label="Edit attribution" style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(20,30,33,0.45)" }} onClick={(e) => { if (e.target === e.currentTarget && !attrBusy) setAttrRow(null); }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink-900)", margin: "0 0 4px" }}>Edit attribution</h2>
            <p style={{ fontSize: 13, color: "var(--ink-500)", margin: "0 0 16px" }}>
              {attrRow.full_name ?? attrRow.email} — {attrRow.city ?? "—"}. Set one commissioner at 100%, or split so weights sum to 100%.
            </p>

            {attrEntries.map((entry, idx) => {
              const w = Number(entry.weight);
              return (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <select
                    className="input-mo"
                    style={{ flex: 1 }}
                    value={entry.commissioner_profile_id ?? ""}
                    onChange={(e) => setAttrEntries((es) => es.map((x, i) => (i === idx ? { ...x, commissioner_profile_id: e.target.value || null } : x)))}
                  >
                    <option value="">Unattributed</option>
                    {attrOptions.map((c) => (
                      <option key={c.profile_id} value={c.profile_id}>{c.full_name}</option>
                    ))}
                  </select>
                  <input
                    type="number" min={0} max={1} step={0.0001}
                    className="input-mo" style={{ width: 96, textAlign: "right" }}
                    value={entry.weight}
                    onChange={(e) => setAttrEntries((es) => es.map((x, i) => (i === idx ? { ...x, weight: e.target.value } : x)))}
                    aria-label="Weight"
                  />
                  <span style={{ fontSize: 12, color: "var(--ink-400)", width: 40 }}>{Number.isFinite(w) ? `${Math.round(w * 100)}%` : ""}</span>
                  {attrEntries.length > 1 ? (
                    <button type="button" className="btn" style={{ fontSize: 12, padding: "6px 8px" }} onClick={() => setAttrEntries((es) => es.filter((_, i) => i !== idx))}>×</button>
                  ) : null}
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 8, margin: "10px 0 16px", flexWrap: "wrap" }}>
              <button type="button" className="btn" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setAttrEntries((es) => [...es, { commissioner_profile_id: null, weight: "0.0000" }])}>+ Add commissioner</button>
              <button type="button" className="btn" style={{ fontSize: 12, padding: "6px 12px" }} onClick={evenSplit}>Even split</button>
              <span style={{ fontSize: 13, color: "var(--ink-600)", alignSelf: "center" }}>
                Sum: {(attrEntries.reduce((s, e) => s + (Number.isFinite(Number(e.weight)) ? Number(e.weight) : 0), 0)).toFixed(4)}
              </span>
            </div>

            {attrError ? <p style={{ fontSize: 13, color: "var(--danger)", margin: "0 0 12px" }}>{attrError}</p> : null}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setAttrRow(null)} disabled={attrBusy} style={{ padding: "10px 16px" }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveAttr} disabled={attrBusy} style={{ padding: "10px 16px" }}>{attrBusy ? "Saving…" : "Save attribution"}</button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
