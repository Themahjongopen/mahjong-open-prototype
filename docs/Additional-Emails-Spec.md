# Feature Spec — Additional Website Emails

_Status: DRAFT for approval (per CLAUDE.md: define before you build)._
_Created 2026-07-01. Owner: Jordan. Implementer: Claude Code._

All emails reuse the shared `buildBrandedEmail(...)` shell (logo header, navy/pink, navy footer with white logo, mailing-address placeholder) and the existing lazy Resend client + env guards. Email failures stay non-blocking. No new env vars.

Copy below is **draft** — Jordan/client to tweak wording. `{ }` = dynamic values.

---

## A. Contact form emails — *Launch 1 · needs a repo check first*

**Dependency:** confirm the Contact page (`/contact` or the marketing Contact section) is an actual **form** vs. just a displayed email address. If it's only a mailto/address, either (a) leave as-is, or (b) build a small form like the commissioner one. Claude Code should check the repo and report before building.

If there IS a form, wire two emails on submit (mirror the commissioner pattern — server route, service-role optional, honeypot):

### A1. Internal notification → themahjongopen@gmail.com
- **Subject:** `New contact message — {name}`
- **Body (branded shell):** labeled fields — Name, Email, (Phone if collected), Message.
- **`reply_to` = sender's email** so the org replies directly from Gmail.

### A2. Auto-reply → the sender
- **Subject:** `Thanks for reaching out to The Mahjong Open`
- **Body (branded shell):**
  > Hi {first name},
  > Thanks for reaching out — we've got your message and someone from The Mahjong Open will get back to you soon.
  > In the meantime, feel free to explore how it works or register for the current series.
  > — The Mahjong Open
- Optional pink CTA: "How it works" or "Register."

**Optional (recommended):** store contact submissions in a Supabase table (`contact_messages`) so nothing is lost if email fails — same reasoning as the commissioner form. Decide with Jordan.

---

## B. Internal "new paid registration" notice — *Launch 1 · small, high value*

Give the org a single running feed of signups, instead of piecing it together from the player's welcome email + Supabase.

- **Where:** `app/api/stripe/webhook/route.ts`, in the existing `checkout.session.completed` branch — right where the welcome email already fires (payment is confirmed at that point).
- **Recipient:** themahjongopen@gmail.com
- **Subject:** `New registration — {name} · {city} ({series})`
- **Body (branded shell):** Name, Email, Phone (if collected), City, Series, Amount paid, Registered at (timestamp). 
- **`reply_to` = player's email.**
- **Idempotency:** it lives in the same already-idempotent completed handler, so it sends once per paid registration (guard alongside the existing welcome-email send).
- No DB change; no new env vars.

---

## C. League-ops emails — *Phase 2 (portal) · OUTLINE ONLY, do not build yet*

These depend on portal data models and flows that aren't finalized (scoring/standings engine, schedule/table model, series lifecycle). Capture now, spec fully during Phase 2 scoping.

Candidate emails, each branded:
1. **Table / schedule assignment** — "You're set for {series}: your table, date, time, location." Trigger: when a player is assigned/scheduled. Include Add-to-Calendar link (already planned for the portal).
2. **Results / standings update** — periodic recap (e.g., after each session): a player's latest score + current ranking, with a link into the portal standings. Trigger: results published. _Open: cadence (per-session vs weekly), opt-out._
3. **Next-series "registration open" reminder** — since auto-renew is off, nudge past players when the next series opens for sign-up. Trigger: new series goes live. Effectively a re-registration prompt.

Open questions for Phase 2:
- Cadence + opt-out/unsubscribe handling (these are more marketing-ish than the transactional ones above — need an unsubscribe mechanism and consent).
- Which events actually trigger sends (tied to the scoring/schedule engine).
- Volume/batching + verified-domain sending limits for list-wide sends.

---

## D. Phase 2 note — portal auth + bulk invite (captured, not built)

At portal launch, existing registered players can be onboarded in bulk:
- **Supabase Auth invites:** loop the registrant list via the Admin API; Supabase sends each a secure invite link to set up their account. Branded via Supabase Auth **email templates**, routed through **Resend (custom SMTP)** so they match the brand — note these are sent by Supabase Auth, not the app's Resend code directly.
- **Launch announcement blast:** a one-time branded "the portal is live — here's how to log in" email via Resend to the same list.
- **Depends on the open auth decision:** magic-link (passwordless — no username/password) vs. email+password (uses the invite/set-password flow). Confirm with client.
- **Deliverability:** batch large sends from the verified domain.

---

## Files for Claude Code (Launch 1 items only — A & B)
- **A:** confirm/inspect Contact page first; if a form exists (or is to be built): a submit route (e.g. `app/api/contact/route.ts`) + the two branded emails via `buildBrandedEmail`; optional `contact_messages` table migration.
- **B:** edit `app/api/stripe/webhook/route.ts` completed branch to also send the internal new-registration notice via `buildBrandedEmail`.
- Reuse `lib/email/brandedEmail.ts`; no new env vars.

## Definition of done (A & B)
- Contact submit (if a form) delivers an internal notice (reply-to = sender) + a branded auto-reply; entries optionally stored.
- Every paid registration also sends a branded internal notice to themahjongopen@gmail.com (reply-to = player), exactly once.
- Verified on prod with a real test.

## Workflow note
Once approved: `cp` into repo `docs/`, hand A & B to Claude Code (C & D stay as Phase 2 planning). Deploy + test.
