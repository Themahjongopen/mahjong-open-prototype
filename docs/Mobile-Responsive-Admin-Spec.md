# Feature Spec — Mobile-Responsive Admin Panel (+ portal spot-check)

_Created 2026-07-01. Owner: Jordan. Implementer: Claude Code. Written for hand-off._

## Goal
Make the **admin panel** fully usable on a phone, and **spot-check + polish the player portal** on mobile. Reported issue: on mobile the admin sidebar is a fixed 220px panel that overlaps/blocks content, and there's no way to open navigation. Design bar per repo `CLAUDE.md`: premium, modern, elegant; subtle animations; proper spacing; no emoji; no generic gradients.

## Decisions (from client 2026-07-01)
- **Mobile admin nav pattern:** hamburger button + **slide-in drawer** over a dimmed backdrop; drawer closes on navigation and on backdrop tap.
- **Scope:** fix the admin panel fully; then spot-check the portal on mobile and fix anything broken.

## Root causes found in the repo
1. **No mobile nav in `components/admin/AdminShell.tsx`.** Sidebar is `position: fixed; width: 220px`; the only responsive rule is `@media (max-width:768px){ .admin-sidebar{display:none} .admin-main{margin-left:0} }`. So on mobile the nav is either gone (no way to reach it) or, on stale/again-visible renders, it overlaps content. There is **no hamburger, no drawer, no backdrop**.
2. **Login page renders the full admin nav.** `app/admin/layout.tsx` wraps **every** `/admin/*` route — including `/admin/login` — in `AdminShell`. So the sidebar shows *before* authentication (this is what the reported screenshot shows: nav over the passcode form). The unauthenticated login page should NOT show the admin nav shell.
3. **Admin content pages use fixed multi-column grids that overflow narrow screens** (inline styles, no breakpoints):
   - `app/admin/players/page.tsx` — 6-col grid `1.4fr 1fr 0.9fr 0.8fr 0.8fr 0.8fr`, `maxWidth: 1200`.
   - `app/admin/tables/page.tsx` — 6-col grid `60px 1.5fr 1fr 1fr 80px 60px`, `maxWidth: 1100`.
   - `app/admin/seasons/page.tsx` — grids `1fr 1fr 80px 80px` and `1fr 1fr`.
   - `app/admin/page.tsx` (dashboard) — `1fr 240px` two-col (Quick links) and `repeat(auto-fit, minmax(180px,1fr))` metric cards; `maxWidth: 980`.
   - `app/admin/cities/page.tsx`, `app/admin/scores/page.tsx` — mostly single-column but confirm padding/inputs fit.
4. **Almost no global breakpoints.** `app/globals.css` has essentially one media rule (content max-width). Responsiveness today lives in scattered inline styles.

## What to build

### 1. Responsive AdminShell (the core fix) — `components/admin/AdminShell.tsx`
- **Desktop (≥ ~900px):** keep the current fixed 220px sidebar + `margin-left: 220px` main. No visual change.
- **Mobile (< ~900px):**
  - Add a slim **top bar** (sticky) containing a **hamburger/menu button** on the left and the "Mahjong Open · Admin" mark. Main content goes full-width (`margin-left: 0`).
  - Tapping the hamburger **slides the sidebar in from the left** (transform/translateX transition, ~200–250ms ease) as an overlay, above a **dimmed backdrop** (semi-transparent, e.g. rgba(0,0,0,0.4)).
  - **Close** the drawer when: a nav link is tapped, the backdrop is tapped, or an X/close control in the drawer is tapped. Add `Esc` to close as a nice-to-have.
  - Keep all existing nav items (Dashboard, Cities, Seasons, Players, Tables, Scores) + the footer (Player portal link, Sign out, admin name).
  - Manage open/closed via React state (`useState`) in this client component; lock body scroll while the drawer is open; ensure the drawer sits above content (`z-index`) and is keyboard/focus reachable.
- Use the existing brand tokens (`--ink-900`, `--fg-on-dark`, radii, shadows). Subtle animation only. No emoji, no gradient.

### 2. Stop the login page showing the admin nav
- The unauthenticated **`/admin/login`** page must render **without** the `AdminShell` sidebar — just the centered passcode card on the plain background.
- Implementer's choice of the cleanest approach, e.g.: move the authed pages under a route group that carries `AdminShell` while `login` sits outside it; **or** have `AdminShell`/the layout detect the login route (`usePathname()`), and render children bare on `/admin/login`. Keep it simple and obvious.

### 3. Make admin content pages reflow on mobile
General rule: below ~768px, multi-column rows should **stack** or the table should **scroll horizontally within its own container** (never push the whole page wide). Prefer stacking to horizontal scroll for readability where feasible.
- **Players (`app/admin/players/page.tsx`):** on mobile, render each registration as a **stacked card** (name/email, city·season, status, payment, joined, and the Player↔Commissioner designation control) instead of a 6-col grid. The designation control must stay easily tappable (≥44px touch target).
- **Tables (`app/admin/tables/page.tsx`):** same treatment — stacked cards on mobile, or a horizontally scrollable table wrapper if a card layout is too heavy.
- **Seasons (`app/admin/seasons/page.tsx`):** the `1fr 1fr …` form/rows should collapse to single column on mobile.
- **Dashboard (`app/admin/page.tsx`):** the `1fr 240px` (content + Quick links) block should stack to one column on mobile; metric cards already use auto-fit (verify they don't get too cramped — min can drop slightly on very narrow screens). Respect the reduced `maxWidth` so nothing overflows.
- **Cities / Scores:** verify inputs, buttons, and padding fit; fix any element that forces horizontal scroll.
- Buttons and inputs should be full-width or comfortably tappable on mobile; maintain the existing spacing rhythm.

### 4. Portal spot-check (polish, not rebuild) — `app/portal/*`, `components/portal/*`
The portal shell is already mobile-first (`PortalAppBar` top + `BottomTabBar` bottom). Just audit on a phone viewport and fix anything broken:
- Confirm content isn't hidden behind the bottom tab bar (adequate bottom padding on scrollable pages).
- Check the new **member profile page** (`app/portal/profile/[id]/page.tsx`) and **directory** (with the Commissioner badge) reflow cleanly.
- Check standings / tables / score-submission pages for any fixed-width rows that overflow; stack them if so.
- No new nav pattern needed for the portal.

## Implementation notes
- Prefer adding a few **real CSS breakpoints** (in `app/globals.css` or component-scoped `<style>`) with reusable classes over piling more inline conditional styles — matches how AdminShell already uses a scoped `<style>` block. Suggested breakpoint: **768px** for content stacking, **~900px** for the sidebar→drawer switch (tune as needed).
- Test at ~375px (iPhone), ~768px (tablet), and desktop. Verify no horizontal page scroll at 375px on every admin route.
- Keep changes CSS/layout-only where possible; don't alter data flow, the passcode gate, or the commissioner designation logic.

## Definition of done
- On a phone, the admin sidebar is hidden by default; a hamburger opens it as a slide-in drawer over a backdrop; it closes on link tap / backdrop / X. Desktop is unchanged.
- `/admin/login` shows only the passcode card — no admin nav.
- No admin route causes horizontal page scroll at 375px; Players/Tables/Seasons/Dashboard reflow (stacked cards / single column); the Player↔Commissioner control stays usable on mobile.
- Player portal audited on mobile; any overflow/hidden-content issues fixed; nothing regressed on desktop.
- `npm run build` passes; deploy to Vercel; verify on an actual phone (the reported `https://themahjongopen.com` URL).

## Open questions
- None blocking. If a data-dense admin table (Players/Tables) is better as horizontal-scroll than stacked cards on mobile, implementer may choose per readability — default is stacked cards.
