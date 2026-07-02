# Feature Spec — Branded icons on the four confirmation screens

_Created 2026-07-01. Owner: Jordan. Implementer: Claude Code. Written for hand-off._

## Goal
Replace the raw emojis on the post-submission confirmation screens with the brand's two-tone icons (navy stroke + soft-pink fill), matching the design rule in `CLAUDE.md` ("No emoji icons"). Four screens, one consistent treatment.

## Current state (why this is needed)
- `app/register/success/page.tsx` — uses a ✅ emoji (`fontSize: 56`). Copy: "You're registered and paid."
- `app/register/cancelled/page.tsx` — uses a ⚠️ emoji. Copy: "Payment didn't go through" / "…registration is still pending."
- `app/(marketing)/contact/page.tsx` — contact-form success state (no brand icon).
- `components/marketing/CommissionerForm.tsx` — success block (~line 123, "Thanks — we've got your interest").

## Assets (already added to the repo)
Four two-tone SVGs are in `public/assets/icons/`:
- `rsvp.svg` — circle with a check → **Registration success**
- `clock.svg` — two-tone clock (newly created to match the set) → **Payment not complete / pending**
- `chat.svg` — speech bubble → **Contact submitted**
- `invite.svg` — paper plane → **Commissioner applied**

Each is `viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="1.75"`, with a `#EC466E` @ 20% fill layer behind the outline.

## Icon → screen mapping
| Screen | File | Component |
|---|---|---|
| Registration success | `rsvp.svg` | `app/register/success/page.tsx` |
| Payment not complete / pending | `clock.svg` | `app/register/cancelled/page.tsx` |
| Contact submitted | `chat.svg` | `app/(marketing)/contact/page.tsx` (success state) |
| Commissioner applied | `invite.svg` | `components/marketing/CommissionerForm.tsx` (success block) |

## What to build

### Consistent icon treatment (all four)
- **Inline the SVG markup** in the component (do NOT load via `<img src>` — these use `stroke="currentColor"`, and inlining lets the stroke inherit the navy text color; an `<img>` would render it black and drop the two-tone look). The `public/assets/icons/*.svg` files are the source of truth — copy their inner markup in.
- Wrap each icon in a **soft-pink circle**: ~56–64px circle, `background: var(--pink-50)` (the light pink already in the palette), icon ~28–30px centered, icon color = navy (`color: var(--ink-900)` on the wrapper so `currentColor` resolves to navy).
- Replace the emoji `<div>` on each screen with this icon-in-circle, keeping the existing heading, body copy, and CTA button unchanged and the same centered card layout.
- **Sizing/spacing consistent across all four** so the screens feel like a set.
- **Accessibility:** the SVG is decorative → `aria-hidden="true"` (the heading text carries the meaning). Remove the old emoji `aria-hidden` divs.
- **Recommended:** factor the circle+icon into one small shared component (e.g. `components/ui/ConfirmationIcon.tsx` taking an icon name/slot) so all four screens use the same wrapper and stay visually identical. Optional but preferred over copy-pasting the wrapper four times.

### Copy
- Leave the existing copy as-is (it's fine). Do not reintroduce emojis anywhere.

## Definition of done
- All four confirmation screens show the correct two-tone brand icon in a soft-pink circle; **no emojis remain** on any of them.
- The four screens are visually consistent (same circle size, icon size, spacing).
- Icons render with the navy stroke + pink fill (confirming they were inlined, not `<img>`-embedded).
- Headings/body/CTAs unchanged; mobile layout still centers cleanly.
- `npm run build` passes.

## Notes
- Full icon set (18 + the new clock) lives in `~/Downloads/brand-assets/icons`; only the four above are needed for this task. Others (`trophy`, `standings`, `calendar`, etc.) are earmarked for the Phase 2 portal.
