# Feature Spec — City Commissioner Interest Form

_Status: APPROVED 2026-06-30 — ready for handoff to Claude Code._
_Created 2026-06-30. Owner: Jordan. Implementer: Claude Code (in `~/Documents/GitHub/mahjong-open-prototype`)._

## Goal
Let people who want to **lead the Mahjong Open in their own city** (and act as that city's commissioner) express interest from the public site. Entries are stored in Supabase and a notification email is sent to **themahjongopen@gmail.com**. There is **no buy-in / no franchise fee** for new cities.

## Decisions locked (from Jordan, 2026-06-30)
- **Delivery:** Save each entry to a Supabase table **and** send a Resend notification email to themahjongopen@gmail.com.
- **Placement / UX:** A section on the **homepage** with a **button** that opens the form in a **separate window/tab** (dedicated page), not a modal.
- **Field depth:** **Lean** — no more comprehensive than the competitor's form; trim where possible while still capturing what's needed to evaluate a candidate.
- **Location field:** **Free-text city/region** (these are new cities not yet in the `cities` table).

## Decisions confirmed (Jordan, 2026-06-30)
1. **Public "no buy-in" line** — ✅ Yes. Advertise "No franchise fees. No buy-in." on the section and page.
2. **Route slug** — ✅ `/lead-a-city`.
3. **Applicant auto-acknowledgment email** — ✅ Yes. Send applicants a short branded "thanks, we got it" email in addition to the internal notification.
4. **Section headline/CTA wording** — ✅ Confirmed as drafted below ("Bring the Mahjong Open to your city" / "Apply to lead a city").

_No open questions remain — this spec is approved and ready for handoff to Claude Code._

---

## 1. Homepage section (entry point)

A new section placed on the homepage (suggested: below the registration/hero area, above the footer — final position Jordan's call).

**Draft copy (brand voice — warm, community-first, premium):**

> **Bring the Mahjong Open to your city**
>
> The Mahjong Open grows one community at a time. If you love the game and want to build something local, you can lead the Mahjong Open in your city as its commissioner — we'll bring the structure, the brand, and the support. No franchise fees. No buy-in. Just your community and the game.
>
> **[ Apply to lead a city ]**

- The button is a link to the dedicated form page and **opens in a new window/tab**: `target="_blank" rel="noopener noreferrer"`.
- Design: navy + pink brand palette, generous spacing, subtle entrance animation, **no emoji**, no generic gradients (per project design rules). Match the existing marketing components' styling.

---

## 2. Dedicated form page

- **Route:** `/lead-a-city` (under `app/(marketing)/lead-a-city/page.tsx`).
- Short hero/intro restating the invitation + the "no buy-in" reassurance, then the form.
- On success: inline thank-you state ("Thanks — we've got your interest and will be in touch."). No redirect needed.
- Honors the same noindex behavior as the rest of the pre-launch site until launch.

---

## 3. Form fields (LEAN — 8 required, 4 optional)

Required marked **\***. This is intentionally shorter than the competitor's ~18 fields; overlapping questions are merged.

**Contact & location**
1. **Full name \*** — text
2. **Email \*** — email
3. **Phone \*** — tel
4. **What city / region would you bring the Mahjong Open to? \*** — free text
5. Social media and/or website — text (optional; one combined field)

**Mahjong background**
6. **How would you describe your Mahjong experience? \*** — short paragraph ("Formal teaching, casual play, clubs, tournaments, or a mix — however you Mahj.")
7. **Do you currently teach or organize Mahjong? \*** — select: *Yes, regularly* / *Occasionally* / *Not yet* (merges the competitor's "teacher?" + "how long" + "how often you host")
8. **Roughly how many local players could you realistically bring or reach? \*** — select buckets: *1–10* / *11–25* / *26–50* / *50+* (merges "contacts" + "anticipated participants")

**Community & motivation**
9. Where do people in your area usually play? — multi-select (optional): *Private homes* / *Clubs or country clubs* / *Restaurants or cafés* / *Community or rec centers* / *Other*
10. **Why do you want to lead the Mahjong Open in your city? \*** — paragraph
11. How soon would you hope to launch? — select (optional): *As soon as possible* / *1–3 months* / *3–6 months* / *Just exploring for now*
12. Anything else you'd like us to know? — paragraph (optional)

**Dropped from the competitor's form (kept lean):** separate "years teaching," "typical attendance" (covered by reach bucket), referral name. _If the client wants a referral/"how did you hear about us" field, add one optional text field — flag for Jordan._

---

## 4. Data storage — Supabase

New table `commissioner_applications`. Inserts happen **server-side via the service-role admin client only** (same pattern as registration); the anon key should not be able to read or write it.

```sql
-- supabase/migrations/00X_commissioner_applications.sql
create table public.commissioner_applications (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  full_name       text not null,
  email           text not null,
  phone           text not null,
  proposed_city   text not null,
  socials         text,
  experience      text not null,
  teaches_organize text not null,   -- 'regularly' | 'occasionally' | 'not_yet'
  reach_estimate  text not null,    -- '1_10' | '11_25' | '26_50' | '50_plus'
  play_venues     text[],           -- multi-select values
  motivation      text not null,
  desired_timeline text,            -- 'asap' | '1_3' | '3_6' | 'exploring'
  notes           text,
  status          text not null default 'new', -- new|reviewing|contacted|approved|declined
  source          text              -- optional referrer/UTM
);

alter table public.commissioner_applications enable row level security;
-- No public policies: only the service-role key (server) can insert/select.
```

---

## 5. Submission API + email — Resend

- **Route:** `app/api/commissioner-apply/route.ts`, **Node runtime** (so Resend + service-role work, matching the webhook).
- Flow: validate input → insert row via service-role Supabase client → send Resend notification to **themahjongopen@gmail.com** → return success. Insert is the source of truth; if email send fails, still return success (entry is saved) but log the error.
- **Reuse existing helpers / patterns:** the lazy-instantiated Supabase admin client and Resend client with env guards (so a missing key returns a clean 503 / skips email instead of crashing the build — same fix already applied to registration).
- **Notification email:**
  - Subject: `New city commissioner application — {proposed_city}`
  - Body: all submitted fields, clearly labeled (brand header optional; plain is fine for an internal notice).
  - `reply_to` set to the **applicant's email** so the client can reply directly from Gmail.
- **Applicant acknowledgment** (confirmed): after a successful submission, send the applicant a short branded "thanks, we received your interest — we'll be in touch" email, reusing the existing welcome-email styling (navy/pink, logo). Non-blocking: if it fails, the entry is still saved and the internal notice still sends.

### Anti-spam (public form)
- Add a hidden **honeypot** field; if filled, silently accept-and-drop (return 200, no insert).
- Basic guard: reject obviously empty/invalid payloads server-side; consider a simple per-IP/time throttle if spam appears.

---

## 6. Files for Claude Code to create / edit

- `supabase/migrations/00X_commissioner_applications.sql` — new table (above).
- `components/marketing/CommissionerSection.tsx` — homepage section + CTA button (new-tab link).
- Add `<CommissionerSection />` to the homepage (`app/(marketing)/page.tsx` or equivalent).
- `app/(marketing)/lead-a-city/page.tsx` — dedicated page with intro + form.
- `components/marketing/CommissionerForm.tsx` — the form (client component) posting to the API.
- `app/api/commissioner-apply/route.ts` — Node runtime; service-role insert + Resend notify + honeypot.
- Reuse existing Supabase admin + Resend helpers and env-guard pattern; no new env vars required (uses `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` already set in Vercel).

## 7. Definition of done
- Section visible on homepage; "Apply to lead a city" opens `/lead-a-city` in a new tab.
- Submitting a valid form inserts a row in `commissioner_applications` and lands a notification email in themahjongopen@gmail.com with reply-to = applicant.
- Honeypot blocks bot spam; invalid input handled gracefully.
- Styling matches brand (navy/pink, no emoji, subtle animation) and the page respects pre-launch noindex.
- Verified with a real test submission on the prod URL (a green build alone doesn't prove env keys are wired).

---

## Addendum — Email branding (approved 2026-06-30)
Both commissioner emails should match the branded welcome email. **Decision: fully brand both** (internal notification + applicant acknowledgment).

Reference styling from the welcome email (`app/api/stripe/webhook/route.ts`): logo header (`/assets/logo-email.png`), navy + pink palette, pink CTA button, white logo on navy footer (`/assets/logo-email-white.png`), `ASSET_BASE = https://themahjongopen.com` (domain connected 2026-07-08).

Implementation guidance for Claude Code:
- **Refactor to avoid duplication:** extract the welcome email's HTML shell (header + body wrapper + navy footer) into a shared helper (e.g. `lib/email/brandedEmail.ts`) that takes a title + inner HTML, and have BOTH the welcome email and the two commissioner emails use it. Don't copy-paste the markup three times.
- **Applicant acknowledgment:** branded shell, friendly copy ("Hi {name}, we've received your interest in leading The Mahjong Open in {city}…"), optional pink CTA (e.g. link back to the site or "How It Works"); footer logo + mailing-address placeholder same as welcome email.
- **Internal notification:** same branded shell, subject unchanged (`New city commissioner application — {city}`), body = the labeled field list wrapped in the branded template; keep `reply_to` = applicant email.
- Reuse the existing lazy Resend client + env guards; email failures stay non-blocking. Keep the mailing-address footer placeholder consistent with the welcome email (still pending the client's real address).
- No new env vars; no DB changes.

## Workflow note
Once approved: copy this spec into the repo's `docs/` folder, then hand implementation to Claude Code in VSCode, then deploy to Vercel for review (per the project's division of labor).
