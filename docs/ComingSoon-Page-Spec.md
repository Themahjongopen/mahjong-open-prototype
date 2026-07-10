# Coming-Soon FULL-SITE GATE + Waitlist — Spec

> ## ✅ APPROVED by Jordan 2026-07-09 — ready to build (Claude Code). Waitlist emails = internal-notice-only.

Per project Rule 2 (define + approve before code). Updated 2026-07-09 per Jordan:
**full-site gate** (hide the whole site behind a branded teaser), **email waitlist capture**,
**no launch date**. Also folds in **removing "Sign In" for Phase 1** (below).

## What it is / who uses it
When the gate is ON, every public visitor to themahjongopen.com sees a single branded
**coming-soon teaser** with an email waitlist form — the rest of the site is hidden. Jordan /
Claude Code can still review the real site via an ungated URL + a preview bypass. The gate is
**env-toggled** so it can be flipped OFF at the Phase 1 public launch without a code change.

## Gate mechanism (`proxy.ts` — this project's Next.js middleware)
- **Toggle:** env var `COMING_SOON` (`"true"` = gate on). Add `COMING_SOON=true` in Vercel
  Production to activate; remove/set false + redeploy to launch.
- **Behavior when ON:** rewrite all gated requests to render the `/coming-soon` teaser
  (rewrite, keep the URL; 200) — or redirect to `/coming-soon`, Claude Code's call; rewrite
  is cleaner.
- **Host-scoping:** gate applies to the **apex domain** (`themahjongopen.com`) only. The
  Vercel preview URL (`mahjong-open-prototype-pi.vercel.app`) stays **ungated** so Jordan /
  Claude Code can review the full real site anytime. (Matches the earlier plan.)
- **Preview bypass:** `?preview=<token>` on the domain sets an HttpOnly cookie that bypasses
  the gate for that browser (to show stakeholders the real site). Token = an env var
  (`COMING_SOON_BYPASS`). Optional but recommended.
- **Exemptions (always reachable even when gate ON):**
  - `/coming-soon` (the teaser itself) and its assets.
  - `/api/*` — so the waitlist form AND the Stripe webhook / other endpoints keep working.
  - `/_next/*`, `/assets/*`, favicon, robots, sitemap — static + framework.
  - `/admin` — already passcode-gated; keep reachable so Shari/Jordan can manage cities
    during the gate.
  - **NOT exempt:** `/register`, `/lead-a-city`, `/portal`, `/login`, marketing pages — all
    hidden behind the teaser during the gate. (Registration is intentionally closed while
    you're collecting waitlist emails; open it by flipping the gate off at Phase 1 launch.)
- Ships with the env var **unset by default** in code (fails safe = OFF); activate by setting
  `COMING_SOON=true` in Vercel + redeploy.

## Teaser page (`/coming-soon`)
- Route `app/(marketing)/coming-soon/page.tsx`, **noindex, nofollow**.
- Full-screen, premium/minimal, on-brand (navy/pink/lime, Bodoni Moda display, logo/mark).
  No emoji, no generic gradients (repo `CLAUDE.md`).
- Content: logo/mark · headline **"Coming soon"** · warm 1–2 line subline in brand voice
  (e.g. *"A city-based mahjong social league for everyone who loves the game. Be the first to
  know when we open."*) · **email waitlist form** (email field + "Notify me" → success state)
  · honeypot hidden field · subtle entrance animation. **No date.**

## Data (waitlist)
- Migration **`008_waitlist.sql`**: table `waitlist` (`id uuid pk default gen_random_uuid()`,
  `email text not null` unique case-insensitive, `created_at timestamptz default now()`),
  RLS **on**, service-role insert only (mirror `commissioner_applications`).
- Dupe emails: `on conflict do nothing`, still return success (don't leak membership).

## API (`app/api/waitlist/route.ts`)
- POST `{ email, website? (honeypot) }`. Honeypot filled → silent 200, no insert.
- Validate email; lazy service-role insert + env guard; dedupe as above.
- Emails: **internal notice to themahjongopen@gmail.com only** (so Jordan sees signups land),
  via `buildBrandedEmail(...)`; skip the subscriber confirmation to keep it basic. Reuses
  Resend, no new env vars. (Jordan's pending call — confirmed lean = internal-notice-only.)

## Phase 1 "Sign In" removal (separate from the gate, but do it together)
Rationale: nothing to sign into until Phase 2, and it must be gone before the gate is ever
flipped OFF for the public Phase 1 launch. Remove — don't disable:
- **Nav:** remove the **"Sign In"** link (points at the `/login` demo picker).
- **Footer → Members:** remove **"Sign In"** and **"Player Portal"** links.
- Keep **"Register"** (that IS Phase 1). Re-add Sign In wired to real auth in Phase 2.
- While here, neutralize the exposed prototype surfaces on `main` so a gate-off state is
  safe: redirect or gate `/login` (the "Demo mode" page) and `/portal/*` (mock dashboard) —
  e.g. redirect to `/` for Phase 1. (See `Live-Domain-Review-2026-07-09.md` → Critical.)

## "Done" looks like
- With `COMING_SOON=true`: domain shows only the teaser for `/`, `/register`, `/portal`,
  `/login`, etc.; teaser email submit inserts a `waitlist` row (dupes don't error) + internal
  notice arrives; `/api/*` + `/admin` still work; the vercel.app URL still shows the full
  site; `?preview=` bypass reveals the full site on the domain.
- With the var unset: site behaves normally (gate off) — proving the toggle.
- Nav/footer no longer show Sign In / Player Portal; `/login` + `/portal` redirect away.
- Migration 008 applied; deployed; test signup verified + test row deleted.

## Verify (3-URL check after activating)
1. `themahjongopen.com` → teaser only.
2. `mahjong-open-prototype-pi.vercel.app` → full real site.
3. `themahjongopen.com/?preview=<token>` → full real site on the domain.
Plus: submit a test email → row + internal notice; confirm `/api/stripe/webhook` still
reachable (not gated).
