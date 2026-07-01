# Feature Spec — Admin views real registrations in the dashboard (Phase 1)

_Created 2026-07-01. Owner: Jordan. Implementer: Claude Code. Written for hand-off._

## Goal
At Phase 1 launch, an admin should be able to open the admin dashboard **Players** page and see the **real people who have registered** (and whether they've paid). Today they can't — the page reads the wrong table.

## The problem (verified in the repo)
Two different tables are involved, and the admin page reads the wrong one:
- **Registrations land in `registrations`.** `/api/register` inserts each signup into `public.registrations` (`full_name, email, phone, city_id, series_id, skill_level, paid_status, created_at`); the Stripe webhook flips `paid_status` to `paid` after payment. This is the real source of truth for who signed up.
- **The admin Players page reads `profiles`.** `app/admin/players/page.tsx` fetches `GET /api/admin/players`, whose handler queries `public.profiles` (`id, full_name, email, role`) and **fabricates** the city/season/status/payment columns. `profiles` is keyed to `auth.users` — i.e., it's only populated once **portal auth accounts exist, which is Phase 2**. Nothing creates a `profiles` row at registration.
- **Net effect in Phase 1:** `profiles` is empty, so the Players page shows an empty/mock list, while the real paying registrants sit unseen in `registrations`. (Admins can currently only view them via the raw Supabase dashboard.)

## Data model reference (migration `003_launch1_registration.sql`)
`public.registrations`:
- `id` (uuid), `full_name`, `email`, `phone` (nullable)
- `city_id` → `public.cities (name, state)`
- `series_id` → `public.series (name)`
- `skill_level` — `beginner | intermediate | advanced`
- `paid_status` — `pending | paid | refunded`
- `created_at` (timestamptz); `UNIQUE (email, series_id)` (one signup per email per series)

RLS is on with **no public policies** — registrations are read only via the **service-role key** server-side. The admin route already uses the service-role admin client, so no new policy is needed.

## What to build

### 1. Rewire `GET /api/admin/players` to read `registrations`
- Keep the existing **passcode auth guard** (`isAuthorized`) exactly as-is.
- Replace the `profiles` query with a `registrations` query using the service-role client, joined to cities + series, e.g.:
  ```
  supabase
    .from("registrations")
    .select("id, full_name, email, phone, skill_level, paid_status, created_at, cities(name, state), series(name)")
    .order("created_at", { ascending: false })
  ```
- Return rows shaped for the page: `id, full_name, email, phone, skill_level, paid_status, created_at, city: cities?.name (+ state), series: series?.name`.
- **Empty state:** return an empty array cleanly (page shows "No registrations yet"), not an error.
- Keep a **mock fallback** for local preview when no service-role client is configured — but reshape the mock to look like registrations (name/email/phone/city/series/paid_status/date), not the old profiles mock.

### 2. Update the Players page (`app/admin/players/page.tsx`) to a registrations view
- Rename the heading to **"Registrations"** (or "Registered players"); subtitle shows counts, e.g. `{paidCount} paid · {totalCount} total`.
- Columns: **Name, Email, Phone, City, Series, Skill, Payment (paid_status), Registered (date)**. Drop the fabricated "Status" (active/pending/canceled) column — registrations only have `paid_status`.
- **Show ALL registrations** (paid, pending, and refunded), each with a **payment status badge** — DECIDED. `paid` = green, `pending` = amber/butter, `refunded` = muted. Pending rows are useful for follow-up.
- Keep the **mobile card reflow** that already exists (stacked cards < 768px); make sure the new fields fit the card layout.
- Add a simple filter — **All / Paid / Pending** — above the list.

### 2b. CSV export — DECIDED: include it
- Add an **"Export CSV"** button on the Registrations page (near the heading/filter).
- Export columns: **Name, Email, Phone, City, Series, Skill, Payment status, Registered date** (no amount column — see below). Same field set as the table.
- Export the **currently filtered** set (if the All/Paid/Pending filter is active, export what's shown); simplest acceptable alternative is export-all — implementer's call, but filtered is preferred.
- Generate client-side (build a CSV string from the already-loaded rows, download via a Blob/anchor) — no new endpoint needed. Quote/escape fields containing commas, quotes, or newlines. Filename e.g. `registrations-YYYY-MM-DD.csv`.

### 3. Park the Player↔Commissioner designation control for Phase 2
- That control updates `profiles.role`, which requires portal accounts that don't exist in Phase 1. **Remove/hide it from this page for Phase 1** so the page is a clean read-only registrations viewer.
- Re-introduce it in **Phase 2** once portal auth + `profiles` exist (it will then likely live against `profiles`/membership, and can join back to registrations by email). Add this to the Phase 2 backlog.
- The `PUT /api/admin/players` designation handler can stay in the codebase but is unused in Phase 1; leave a comment noting it's Phase-2.

## Decisions (resolved 2026-07-01)
- **Show all registrations with a payment-status badge** (paid/pending/refunded) — yes.
- **CSV export** — yes, include it (section 2b).
- **Amount-paid column** — no. `paid_status` alone is enough; do not add an amount column or join `payments`/`series.price_cents`.

## Out of scope (Phase 2)
- Editing/managing players, refunds handling.
- Linking registrations to portal accounts (happens when auth lands).
- The Player↔Commissioner designation control (parked; see Phase 2 backlog).

## Definition of done
- With the client's Supabase configured, the admin **Registrations** page lists **real rows from `registrations`**, newest first, showing name/email/phone/city/series/skill/payment status/date.
- Paid vs pending is visually clear; empty state reads cleanly when there are no signups.
- **Export CSV** button downloads the (filtered) registrations with the agreed columns (no amount column).
- Passcode gate still protects the page; mobile card layout still works.
- The commissioner designation control is not shown in Phase 1.
- Verified in prod by doing a real test registration and seeing it appear (paid after Stripe test-card payment; pending before).
- `npm run build` passes.

_All prior open questions resolved 2026-07-01 (see Decisions above)._
