"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { groupCitiesByState } from "@/lib/cities/groupByState";
import { compressImage } from "@/lib/image/compressImage";

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  // Present only when the visitor arrived via a commissioner referral link
  // (/join/<code>). Determines attribution up front — the dropdown is suppressed
  // and a quiet confirmation is shown instead. Absent for every normal visitor.
  referral?: { code: string; cityId: string; host: string } | null;
}

type Step = "form" | "success";

type CityOption = {
  id: string;
  name: string;
  state: string | null;
  split_commission?: boolean;
};

type Commissioner = { profile_id: string; full_name: string };

type SeriesOption = {
  id: string;
  name: string;
  registration_closes_at: string | null;
};

export default function RegisterModal({ open, onClose, referral = null }: RegisterModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cities, setCities] = useState<CityOption[]>([]);
  const [currentSeries, setCurrentSeries] = useState<SeriesOption | null>(null);
  // "How did you hear about us?" — only used for split_commission cities with no
  // referral link. "" = unanswered, a profile_id = a specific commissioner,
  // "organic" = "I found it on my own".
  const [heardAbout, setHeardAbout] = useState("");
  const [commissioners, setCommissioners] = useState<Commissioner[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city_id: "",
    series_id: "",
    skill_level: "" as "beginner" | "intermediate" | "advanced" | "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const supabase: any = createClient();
    let upload = file;
    try {
      upload = await compressImage(file);
    } catch {
      // fall back to the original file if compression itself throws
    }
    const ext = (upload.name.split(".").pop() || "jpg").toLowerCase();
    // Pre-auth staging upload (no account yet). RLS allows anon inserts only
    // under the registrations/ prefix; the photo is carried onto the profile
    // when the member later accepts their portal invite.
    const path = `registrations/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, upload, { contentType: upload.type });
    if (upErr) {
      setError("Photo upload failed. Use a JPG, PNG, or WebP under 3 MB.");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Bring the error banner into view when it appears — a banner below the fold
  // (short viewport / mobile keyboard open) would otherwise exist off-screen and
  // read as "nothing happened."
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const supabase: any = createClient();

    async function loadCatalog() {
      const [{ data: cityData, error: cityError }, { data: seriesData, error: seriesError }] = await Promise.all([
        supabase.from("cities").select("id, name, state, split_commission").eq("is_active", true).order("name", { ascending: true }),
        supabase.from("series").select("id, name, registration_closes_at").eq("is_active", true).order("starts_at", { ascending: true }),
      ]);

      if (!active) return;

      if (cityError) {
        console.error("Failed to load cities", cityError);
      }

      if (seriesError) {
        console.error("Failed to load active series", seriesError);
      }

      const nextCities = cityData ?? [];
      const nextSeries = seriesData?.[0] ?? null;

      setCities(nextCities as CityOption[]);
      setCurrentSeries(nextSeries as SeriesOption | null);
      setForm((current) => ({
        ...current,
        // A referral link preselects the commissioner's city; otherwise leave the
        // player's own selection (or empty) untouched.
        city_id: current.city_id || referral?.cityId || "",
        series_id: current.series_id || nextSeries?.id || "",
      }));
    }

    loadCatalog();

    return () => {
      active = false;
    };
  }, [open]);

  // Load the "How did you hear about us?" options for a split_commission city
  // that has no applicable referral. For every non-split city (21 of 22) this
  // just clears the list and makes no request — the common path is untouched.
  useEffect(() => {
    if (!open) return;
    const selected = cities.find((c) => c.id === form.city_id);
    const isSplit = selected?.split_commission === true;
    const referralApplies = !!referral && form.city_id === referral.cityId;
    if (!isSplit || referralApplies || !form.city_id) {
      setCommissioners([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/commissioners?city_id=${encodeURIComponent(form.city_id)}`);
        const payload = await res.json().catch(() => ({}));
        if (active) setCommissioners((payload.commissioners ?? []) as Commissioner[]);
      } catch {
        if (active) setCommissioners([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, form.city_id, cities, referral]);

  function reset() {
    setStep("form");
    setForm({ full_name: "", email: "", phone: "", city_id: "", series_id: currentSeries?.id ?? "", skill_level: "" });
    setAvatarUrl(null);
    setUploading(false);
    setError("");
    setLoading(false);
    setHeardAbout("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const selectedSeriesId = form.series_id || currentSeries?.id || "";

    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim() || !form.city_id || !selectedSeriesId || !form.skill_level) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!avatarUrl) {
      setError("Please add a profile photo.");
      return;
    }

    // Split-city "How did you hear about us?" is required — unless a referral link
    // already determined attribution. Recomputed here; never trust render state.
    const selCity = cities.find((c) => c.id === form.city_id);
    const referralApplies = !!referral && form.city_id === referral.cityId;
    const dropdownRequired = selCity?.split_commission === true && !referralApplies;
    if (dropdownRequired && !heardAbout) {
      setError("Please let us know how you heard about us.");
      return;
    }

    setLoading(true);
    // Bound how long "Saving your spot…" can hang: /api/register creates a Stripe
    // session, so give it a generous 20s, then abort so the button re-enables with
    // an actionable message instead of an indefinite spinner.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          city_id: form.city_id,
          series_id: selectedSeriesId,
          skill_level: form.skill_level,
          avatar_url: avatarUrl,
          // Attribution inputs — both omitted on the common path, so a normal
          // registration payload is unchanged.
          referral_code: referralApplies ? referral!.code : undefined,
          heard_about: dropdownRequired ? heardAbout : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed. Please try again.");
      }

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Payment checkout was not returned.");
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      // Specific messages from /api/register arrive as Error(data.error) and show
      // verbatim. Only the raw browser-thrown cases get a plain-language rewrite:
      // an aborted (timed-out) request, or a network failure whose TypeError
      // message is an unhelpful "Failed to fetch" / "Load failed".
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("This is taking longer than expected. Check your connection and try again.");
      } else if (err instanceof TypeError) {
        setError("Couldn't reach the server — check your connection and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Attribution UI state (all false for the 21 non-split cities with no referral,
  // so the form below renders exactly as it did before this feature).
  const selectedCity = cities.find((c) => c.id === form.city_id) ?? null;
  const cityIsSplit = selectedCity?.split_commission === true;
  // A referral applies only to its own city; switching cities drops it.
  const hasReferral = !!referral && form.city_id === referral.cityId;
  const showDropdown = cityIsSplit && !hasReferral && !!form.city_id;

  // Registration stays open through the close date (inclusive). The catalog
  // query only returns active series, so this handles the "series still active
  // but past its deadline" case; the register API enforces the same rule.
  const today = new Date().toISOString().slice(0, 10);
  const seriesClosed = Boolean(
    currentSeries?.registration_closes_at && currentSeries.registration_closes_at < today
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: "var(--overlay-scrim)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Register for The Mahjong Open"
        style={{
          background: "#fff",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 2,
            background: "#fff",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-500)",
            padding: 4,
            borderRadius: "50%",
            lineHeight: 0,
          }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "40px 36px",
          }}
        >
        {step === "success" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--lime-50)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Check size={24} color="var(--lime-600)" />
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--ink-900)",
                marginBottom: 12,
              }}
            >
              You&rsquo;re on the list!
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 28 }}>
              You&rsquo;re registered — watch for details.
            </p>
            <button className="btn btn-primary" onClick={handleClose} style={{ justifyContent: "center" }}>
              Done
            </button>
          </div>
        ) : seriesClosed ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>{currentSeries?.name}</p>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--ink-900)",
                marginBottom: 12,
              }}
            >
              Registration has closed
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 28 }}>
              Registration for this series has closed. Check back soon for the next one.
            </p>
            <button className="btn btn-primary" onClick={handleClose} style={{ justifyContent: "center" }}>
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow" style={{ marginBottom: 8 }}>{currentSeries?.name ?? "The Mahjong Open — 2026 — Series One"}</p>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 30,
                fontWeight: 400,
                lineHeight: 1.1,
                color: "var(--ink-900)",
                marginBottom: 24,
              }}
            >
              Join the{" "}
              <em style={{ color: "var(--pink-400)" }}>Mahjong Open</em>
            </h2>

            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Full name">
                <input
                  className="input-mo"
                  type="text"
                  placeholder="Your name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  autoComplete="name"
                />
              </Field>

              <Field label="Email address">
                <input
                  className="input-mo"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="email"
                />
              </Field>

              <Field label="Phone number">
                <input
                  className="input-mo"
                  type="tel"
                  placeholder="(601) 555-0147"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </Field>

              <Field label="City">
                <select
                  className="input-mo"
                  value={form.city_id}
                  onChange={(e) => { setForm((f) => ({ ...f, city_id: e.target.value })); setHeardAbout(""); }}
                  disabled={cities.length === 0}
                >
                  <option value="">Select your city</option>
                  {groupCitiesByState(cities).map((group) => (
                    <optgroup key={group.stateLabel} label={group.stateLabel}>
                      {group.cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}, {city.state}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>

              {/* Attribution: nothing for the 21 non-split cities with no referral
                  (byte-identical to the pre-feature form). A referral link shows a
                  quiet confirmation and no input; a split city with no link shows a
                  required "How did you hear about us?" select. */}
              {hasReferral ? (
                referral?.host ? (
                  <p style={{ fontSize: 13, color: "var(--ink-500)", marginTop: -4 }}>
                    Registering with <strong style={{ color: "var(--ink-800)" }}>{referral.host}</strong>.
                  </p>
                ) : null
              ) : showDropdown ? (
                <Field label="How did you hear about us?">
                  <select
                    className="input-mo"
                    value={heardAbout}
                    onChange={(e) => setHeardAbout(e.target.value)}
                  >
                    <option value="">Select an option</option>
                    {commissioners.map((c) => (
                      <option key={c.profile_id} value={c.profile_id}>{c.full_name}</option>
                    ))}
                    <option value="organic">I found it on my own</option>
                  </select>
                </Field>
              ) : null}

              <Field label="Skill level">
                <select
                  className="input-mo"
                  value={form.skill_level}
                  onChange={(e) => setForm((f) => ({ ...f, skill_level: e.target.value as typeof form.skill_level }))}
                >
                  <option value="">Select level</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </Field>

              <Field label="Profile photo">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: "var(--hair-200)", flexShrink: 0 }}>
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : null}
                  </div>
                  <div>
                    <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ fontSize: 13, padding: "8px 14px" }}>
                      {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                    </button>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{ display: "none" }} />
                    <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Required · JPG, PNG, or WebP · any size — large photos are resized automatically.</p>
                    <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>Please use a real photo of yourself — no avatars, illustrations, or logos.</p>
                  </div>
                </div>
              </Field>

              {error && (
                <div
                  ref={errorRef}
                  role="alert"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    background: "#fdecee",
                    border: "1px solid var(--danger)",
                  }}
                >
                  <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 14, color: "var(--danger)", margin: 0, lineHeight: 1.4 }}>{error}</p>
                </div>
              )}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || uploading}
                style={{ marginTop: 8, justifyContent: "center", padding: "14px 24px" }}
              >
                {loading ? "Saving your spot…" : "Save my spot →"}
              </button>
            </form>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>{label}</label>
      {children}
    </div>
  );
}
