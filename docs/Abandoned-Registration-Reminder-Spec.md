# Feature Spec — Abandoned Registration Reminder Email

_Status: DRAFT for approval (per CLAUDE.md: define before you build)._
_Created 2026-07-01. Owner: Jordan. Implementer: Claude Code (in `~/Documents/GitHub/mahjong-open-prototype`)._

## Goal
When someone starts registration but doesn't pay, remind them ~2 hours later with a branded "complete your registration" email that links straight back to their checkout. An abandoned-cart nudge for the $80 registration.

## Why this approach (event-driven via Stripe, not cron)
- **Vercel Hobby limits cron jobs to once per day** with imprecise timing, so a polling job that checks for stale pending registrations every 15–30 min isn't viable without upgrading to Pro or adding an external scheduler.
- Stripe Checkout has **built-in abandoned-cart recovery**, and the project already has a signature-verified webhook. Letting Stripe handle the timing and firing the reminder from the existing webhook is simpler, needs no cron/upgrade, and only ever fires when payment truly didn't happen.

## Decisions locked (Jordan, 2026-07-01)
- **Delay:** ~2 hours (measured from checkout session creation).
- **Frequency:** exactly **one** reminder. No drip sequence.
- **De-dupe:** track send with a `reminder_sent_at` column so it never double-sends.
- **Styling:** reuse the shared `buildBrandedEmail` shell (same look as welcome + commissioner emails).

## How it works
1. **At session creation** (`app/api/register/route.ts`, where the Stripe Checkout Session is created), add:
   - `expires_at` = now + 2 hours (Unix seconds). Stripe allows 30 min–24 h.
   - `after_expiration: { recovery: { enabled: true } }` — this makes Stripe generate a **recovery URL** (valid 30 days) when the session expires. The recovery URL reopens a fresh copy of the checkout so the user resumes where they left off.
2. **On expiry**, Stripe fires **`checkout.session.expired`** to the existing webhook (`app/api/stripe/webhook/route.ts`). Add a handler branch for this event type that:
   - Looks up the linked registration (same lookup the `checkout.session.completed` branch already uses to match session → registration).
   - **Guards (idempotent):** only proceed if the registration is still `paid_status = 'pending'` AND `reminder_sent_at IS NULL`. Skip otherwise.
   - Reads the recovery URL from `session.after_expiration.recovery.url`.
   - Sends a branded reminder email via the lazy Resend client, then sets `reminder_sent_at = now()`.
3. **If they pay within 2 hours**, the session completes normally, `checkout.session.expired` never fires, and no reminder is sent.

## Data change
Add one column to the registrations table (new migration, e.g. `005_registration_reminder.sql`):
```sql
alter table public.registrations
  add column if not exists reminder_sent_at timestamptz;
```

## The reminder email
- **Shell:** `buildBrandedEmail(...)` — logo header, navy/pink, navy footer with white logo, mailing-address placeholder (same as the others).
- **Subject:** e.g. `Your Mahjong Open registration isn't finished`
- **Body:** brief + warm. "Hi {first name}, you're almost in — your spot for {series} isn't confirmed until payment is complete." Include series/city/amount if easily available (same fields the welcome email already pulls).
- **CTA:** pink button "Complete your registration" → the Stripe **recovery URL** from the event payload.
- Keep it to a single clear action; no second CTA.

## Guardrails / notes
- **One reminder only** — `reminder_sent_at` prevents duplicates even if Stripe retries the webhook.
- **Transactional, not marketing** — this nudges an action the user started, so it's appropriate as a transactional send; do not turn it into a sequence.
- **Timing caveat:** the 2 hours run from checkout start, not from when they closed the tab. Acceptable and cleaner.
- **No new env vars.** Reuse existing `STRIPE_*`, `RESEND_API_KEY`, Supabase service-role, and `SITE_URL`/`ASSET_BASE` constants. Email failures stay non-blocking (log, don't crash).
- **Cancelled sessions:** the existing `/register/cancelled` path is separate; this only concerns true expiry. (If a user hits cancel, they can just re-register; the expiry reminder still covers the "walked away" case.)

## Files for Claude Code
- `supabase/migrations/005_registration_reminder.sql` — add `reminder_sent_at`.
- `app/api/register/route.ts` — set `expires_at` + `after_expiration.recovery` on the Checkout session.
- `app/api/stripe/webhook/route.ts` — add `checkout.session.expired` branch: guard → send branded recovery email → stamp `reminder_sent_at`.
- (Reuse `lib/email/brandedEmail.ts`; no new files needed for styling.)

## Definition of done
- A registration left unpaid for 2 hours produces exactly one branded reminder email with a working recovery link; paying within 2 hours produces none.
- `reminder_sent_at` is set when the reminder sends; webhook retries don't send a second email.
- Verified on prod: start a registration, don't pay, wait for expiry (or temporarily shorten `expires_at` to the 30-min minimum for testing), confirm the email arrives and the recovery link reopens checkout.

## Testing tip
Stripe's minimum `expires_at` is **30 minutes**, so for a live test you can't get a 2-minute expiry. Options: temporarily set `expires_at` to +30 min to verify end-to-end, or use the Stripe API/Dashboard to **manually expire** a test session and confirm the webhook + email fire. Restore the 2-hour value before launch.

## Workflow note
Once approved: `cp` this into the repo's `docs/` folder, hand to Claude Code, deploy, then test on prod.
