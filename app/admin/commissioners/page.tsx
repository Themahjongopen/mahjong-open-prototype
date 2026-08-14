"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";

type Code = {
  id: string;
  code: string;
  is_active: boolean;
  commissioner_name: string;
  city_name: string;
  url: string;
};

export default function AdminCommissionersPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const confirm = useConfirm();

  async function load() {
    const res = await fetch("/api/admin/commissioner-codes", { method: "GET" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Referral codes could not be loaded.");
      return;
    }
    setCodes(payload.codes ?? []);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function copy(c: Code) {
    try {
      await navigator.clipboard.writeText(c.url);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId((id) => (id === c.id ? null : id)), 1500);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  }

  async function setActive(c: Code, isActive: boolean) {
    setBusyId(c.id);
    try {
      const res = await fetch("/api/admin/commissioner-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, is_active: isActive }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Could not update the code.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: Code) {
    const ok = await confirm({
      title: "Delete this referral code?",
      message: `Permanently delete ${c.commissioner_name}'s ${c.city_name} link (${c.code})? This is for a code created in error. To simply stop it attributing while keeping its history, use Deactivate instead — Delete cannot be undone.`,
      confirmLabel: "Delete code",
      danger: true,
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      const res = await fetch("/api/admin/commissioner-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Could not delete the code.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 6 }}>Commissioner referral links</h1>
      <p style={{ fontSize: 14, color: "var(--ink-500)", marginBottom: 20 }}>
        One shareable link per commissioner per city. Deactivate to stop a link attributing new signups while keeping its history; Delete only removes a link created in error.
      </p>

      {error ? (
        <div style={{ background: "#fdecee", border: "1px solid var(--danger)", borderRadius: "var(--radius-md)", padding: "10px 14px", color: "var(--danger)", fontSize: 14, marginBottom: 16 }}>{error}</div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {codes.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--ink-500)" }}>No referral codes yet.</p>
        ) : (
          codes.map((c) => (
            <div
              key={c.id}
              style={{
                background: "#fff",
                border: "1px solid var(--hair-200)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-xs)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                opacity: c.is_active ? 1 : 0.6,
              }}
            >
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", margin: 0 }}>{c.commissioner_name}</p>
                <p style={{ fontSize: 13, color: "var(--ink-500)", margin: "2px 0 0" }}>{c.city_name}</p>
              </div>

              <div style={{ flex: "2 1 320px", minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ fontSize: 12.5, color: "var(--ink-700)", background: "var(--hair-100, #f3f4f4)", padding: "6px 10px", borderRadius: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{c.url}</code>
                <button type="button" className="btn btn-ghost" onClick={() => copy(c)} style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap" }}>
                  {copiedId === c.id ? "Copied!" : "Copy"}
                </button>
              </div>

              <span
                className={`badge ${c.is_active ? "badge-lime" : "badge-mute"}`}
                style={{ fontSize: 11 }}
              >
                {c.is_active ? "Active" : "Inactive"}
              </span>

              <div style={{ display: "flex", gap: 8 }}>
                {c.is_active ? (
                  <button type="button" className="btn btn-ghost" onClick={() => setActive(c, false)} disabled={busyId === c.id} style={{ fontSize: 12, padding: "6px 12px" }}>
                    Deactivate
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost" onClick={() => setActive(c, true)} disabled={busyId === c.id} style={{ fontSize: 12, padding: "6px 12px" }}>
                    Reactivate
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => remove(c)} disabled={busyId === c.id} style={{ fontSize: 12, padding: "6px 12px", color: "var(--danger)" }}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
