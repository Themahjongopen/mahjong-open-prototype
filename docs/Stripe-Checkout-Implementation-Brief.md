# Stripe Checkout — Implementation Brief (for Claude Code)

**Goal:** Add an $80 Stripe Checkout payment to the Launch 1 registration flow. Payment is required to register; the welcome email moves to fire only after payment confirms.

## Confirmed decisions
- **Stripe Checkout (hosted)**, `mode: 'payment'`, card payments.
- **Payment required.** A registration counts as paid only after Stripe confirms. Abandoned/incomplete payments stay `paid_status = 'pending'`.
- **$80 per series** — pull the amount from `series.price_cents` (already 8000), do NOT hardcode.
- **Welcome email fires after payment** (move it out of `/api/register`, into the webhook).
- Build + test in **Stripe test/sandbox mode** first; swap to live keys at launch.

## Environment variables (add to `.env.local` now, and to Vercel later)
- `STRIPE_SECRET_KEY` — test key `sk_test_...` from Stripe → Developers → API keys.
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` from the webhook endpoint (Stripe CLI for local, or the dashboard endpoint for deployed).
- (Reuse existing) the request `origin` header is used for success/cancel URLs; no base-url env needed.

## Relevant existing code/schema
- `lib/supabase/server.ts` → `createAdminClient()` (service-role; returns `null` if env missing — keep that guard pattern).
- `series` table: `id, name, price_cents (8000), is_active`.
- `registrations`: `id, full_name, email, phone, city_id, series_id, skill_level, paid_status ('pending'|'paid'|'refunded')`, `UNIQUE (email, series_id)`.
- `payments`: `id, registration_id, amount_cents, currency, status ('pending'|'succeeded'|'failed'|'refunded'), provider ('stripe'), provider_payment_id`.
- `components/marketing/RegisterModal.tsx` currently POSTs to `/api/register` and shows a success step.
- `app/api/register/route.ts` currently inserts the registration and sends the Resend welcome email.

## Implementation

### 1. Install
`npm install stripe`

### 2. `app/api/register/route.ts` — turn into "create registration + Checkout session"
- Validate fields (as today).
- Get admin client; if `null`, return 503.
- **Look up existing registration** by `(email, series_id)` via `.maybeSingle()`:
  - if found and `paid_status === 'paid'` → return 409 "You're already registered for this series."
  - if found and `pending` → reuse its id (update name/phone/city/skill if changed).
  - else insert new `pending` registration → capture id.
- Fetch `series.price_cents` and `series.name` for that `series_id`.
- Lazily init Stripe (guard `STRIPE_SECRET_KEY`, mirror the Resend lazy pattern). If missing → 503.
- Create Checkout Session:
  - `mode: 'payment'`, `customer_email: email`
  - `line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: series.price_cents, product_data: { name: series.name } } }]`
  - `success_url: `${origin}/register/success?session_id={CHECKOUT_SESSION_ID}``
  - `cancel_url: `${origin}/register/cancelled``
  - `metadata: { registration_id, series_id, email }` and `payment_intent_data.metadata.registration_id`
  - Upsert a `payments` row (`status: 'pending'`, `amount_cents`, `provider: 'stripe'`).
- Return `{ url: session.url }`. **Remove the welcome-email send from here.**

### 3. `app/api/stripe/webhook/route.ts` — new
- Read raw body via `await request.text()` and `stripe-signature` header.
- `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`; on failure return 400.
- On `checkout.session.completed`:
  - `registration_id = session.metadata.registration_id`.
  - Idempotency: if registration already `paid`, return 200 without re-sending email.
  - Update `registrations.paid_status = 'paid'`.
  - Update the `payments` row → `status: 'succeeded'`, `provider_payment_id = session.payment_intent`.
  - Fetch `full_name` + series name, then send the Resend welcome email (moved from register route).
- Return `{ received: true }`.
- Note: ensure this route runs on the Node runtime (`export const runtime = 'nodejs'`) so raw-body signature verification works.

### 4. `components/marketing/RegisterModal.tsx`
- On successful POST response, `window.location.href = data.url` (redirect to Stripe) instead of showing the inline success step.
- Keep validation + error handling. (The success screen now lives at `/register/success`.)

### 5. Pages
- `app/register/success/page.tsx` — "You're registered and paid" confirmation (optionally read `session_id`). Keep it simple/branded.
- `app/register/cancelled/page.tsx` — "Payment didn't go through — your spot isn't reserved yet" with a button back to register.

## Stripe dashboard setup (human steps — see chat)
1. Test-mode **Secret key** → `.env.local` `STRIPE_SECRET_KEY`.
2. Create a **webhook endpoint** for `checkout.session.completed`:
   - Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook` → copy the `whsec_...` it prints into `.env.local`.
   - Deployed: add endpoint `https://<vercel-domain>/api/stripe/webhook` in Stripe → Developers → Webhooks → copy its signing secret into Vercel env.

## Acceptance / test (Stripe test mode)
- [ ] Register with a fresh email → redirected to Stripe Checkout showing **$80.00**.
- [ ] Pay with test card `4242 4242 4242 4242`, any future expiry/CVC → redirected to `/register/success`.
- [ ] `registrations.paid_status` flips to `paid`; a `payments` row is `succeeded` with the Stripe id.
- [ ] Welcome email arrives (and does NOT arrive on abandoned/cancelled payment).
- [ ] Cancel on Checkout → lands on `/register/cancelled`, registration stays `pending`.
- [ ] `npm run build` passes; build doesn't crash when Stripe env vars are absent (mirror the Resend/Supabase lazy guards).
