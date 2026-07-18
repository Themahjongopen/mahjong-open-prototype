# Phase 2 wiring debt — mock data still in the app

Inventory of every page that still reads **mock/demo data** instead of live
Supabase, plus the pattern to follow when wiring each one up. Compiled while
building the admin Series page; accurate as of the `phase2` branch.

## TL;DR

The debt is concentrated in **one place**: the entire [`lib/data/index.ts`](../lib/data/index.ts)
module is a mock shim — every exported function returns `MOCK_*` constants from
[`lib/data/mock.ts`](../lib/data/mock.ts). And [`lib/data/auth.ts`](../lib/data/auth.ts)'s
`getDemoUser()` always returns a hardcoded "Jordan Chen / admin" user.

So **14 pages are fully mock**. Replacing the `lib/data` function bodies with
real Supabase queries and swapping `getDemoUser()` for the real portal session
([`lib/portal/session.ts`](../lib/portal/session.ts), already built in Phase 2
auth) unwires all of them.

Three admin pages are **already wired** and show the target pattern:
[`admin/cities`](../app/admin/cities/page.tsx), [`admin/series`](../app/admin/series/page.tsx),
[`admin/players`](../app/admin/players/page.tsx).

## Fully mock pages (14)

### Admin (3)

| Page | What's fake |
| --- | --- |
| [`app/admin/page.tsx`](../app/admin/page.tsx) | Dashboard metrics, scopes, top finisher from `MOCK_ADMIN_CONSOLE`; admin name from `getDemoUser()` |
| [`app/admin/tables/page.tsx`](../app/admin/tables/page.tsx) | Table list from `getAdminTables()` (`MOCK_TABLES`, with hardcoded `cities: "Los Angeles"` / `seasons: "Spring 2026"`) |
| [`app/admin/scores/page.tsx`](../app/admin/scores/page.tsx) | Pending/approved score submissions from `getAdminScores()` (`MOCK_SCORE_SUBMISSIONS`) |

### Portal — all under the `(shell)` group (11)

| Page | What's fake |
| --- | --- |
| [`app/portal/(shell)/page.tsx`](../app/portal/(shell)/page.tsx) | Dashboard (next seat, standing, greeting) from `getDashboardData()` + `getDemoUser()` |
| [`app/portal/(shell)/tables/page.tsx`](../app/portal/(shell)/tables/page.tsx) | Open tables from `getOpenTables()` (`MOCK_TABLES`) |
| [`app/portal/(shell)/tables/[id]/page.tsx`](../app/portal/(shell)/tables/[id]/page.tsx) | Table detail from `getTableById()` + `getDemoUser()` |
| [`app/portal/(shell)/my-tables/page.tsx`](../app/portal/(shell)/my-tables/page.tsx) | My seats from `getMyTables()` + `getDemoUser()` |
| [`app/portal/(shell)/standings/page.tsx`](../app/portal/(shell)/standings/page.tsx) | Standings + weekly top scores from `getStandings()`, `getWeeklyTopScores()`, `getAdminConsoleData()` |
| [`app/portal/(shell)/directory/page.tsx`](../app/portal/(shell)/directory/page.tsx) | Member directory from `getAdminPlayers()` (`MOCK_PLAYERS`) + `getDemoUser()` |
| [`app/portal/(shell)/profile/[id]/page.tsx`](../app/portal/(shell)/profile/[id]/page.tsx) | Player profile from `getAdminPlayers()` + `getDemoUser()` |
| [`app/portal/(shell)/scores/page.tsx`](../app/portal/(shell)/scores/page.tsx) | Score submission form; imports `DEMO_USER_ID` + `MOCK_TABLES` **directly** (bypasses the data layer) |

> Two `(shell)` pages read no data and are **not** mock:
> [`tables/create`](../app/portal/(shell)/tables/create/page.tsx) and
> [`payment`](../app/portal/(shell)/payment/page.tsx).

## `getDemoUser()` / `DEMO_USER_ID` — the fake "current user"

`getDemoUser()` (in [`lib/data/auth.ts`](../lib/data/auth.ts)) always returns the
same hardcoded user (`user-demo`, "Jordan Chen", role `admin`); `isDemoAdmin()`
always returns `true`. Every call site trusts this for identity even though real
portal auth already exists. Reconciling these with the real session is the
highest-value item — the portal `(shell)` pages should read the authenticated
user, not a demo constant.

Call sites:

- Admin (2): [`admin/layout.tsx:9`](../app/admin/layout.tsx#L9), [`admin/page.tsx:19`](../app/admin/page.tsx#L19)
- Portal (7): [`(shell)/page.tsx`](../app/portal/(shell)/page.tsx),
  [`tables/page.tsx`](../app/portal/(shell)/tables/page.tsx),
  [`tables/[id]/page.tsx`](../app/portal/(shell)/tables/[id]/page.tsx),
  [`my-tables/page.tsx`](../app/portal/(shell)/my-tables/page.tsx),
  [`standings/page.tsx`](../app/portal/(shell)/standings/page.tsx),
  [`directory/page.tsx`](../app/portal/(shell)/directory/page.tsx),
  [`profile/[id]/page.tsx`](../app/portal/(shell)/profile/[id]/page.tsx)
- Direct `DEMO_USER_ID` import: [`(shell)/scores/page.tsx`](../app/portal/(shell)/scores/page.tsx)
  (filters `MOCK_TABLES` by `t.creator_id === DEMO_USER_ID`)

## `lib/data` exports — all mock

Every function in [`lib/data/index.ts`](../lib/data/index.ts) returns mock data.
`getMembership()` / `getDashboardData()` are conditional only in the trivial
sense that they return `MOCK_MEMBERSHIP` when `userId === DEMO_USER_ID` and
`null` otherwise:

Portal: `getDashboardData`, `getOpenTables`, `getTableById`,
`getScoreSubmissionForTable`, `getMyTables`, `getStandings`,
`getWeeklyTopScores`, `getMembership`, `getAnnouncements`,
`getMyCompletedTables`, `getPlayersAtTable`.

Admin: `getAdminConsoleData`, `getAdminDashboardData`, `getAdminPlayers`,
`getAdminTables`, `getAdminScores`, `getAdminCities`, `getAdminSeasons`,
`getAdminAnnouncements`.

## Already wired — the pattern to follow

These are live and show the intended shape. Wire the mock pages to match.

- [`app/admin/cities/page.tsx`](../app/admin/cities/page.tsx) → [`/api/admin/cities`](../app/api/admin/cities/route.ts)
- [`app/admin/series/page.tsx`](../app/admin/series/page.tsx) → [`/api/admin/series`](../app/api/admin/series/route.ts)
- [`app/admin/players/page.tsx`](../app/admin/players/page.tsx) → [`/api/admin/players`](../app/api/admin/players/route.ts)
  — **live, but still has a mock fallback**: [`route.ts:104`](../app/api/admin/players/route.ts#L104)
  returns `MOCK_REGISTRATIONS` when the service-role client is unavailable.

**Pattern (admin, mutable data):** a cookie-gated route under `app/api/admin/<x>/route.ts`
that uses `createAdminClient()` (service role) from [`lib/supabase/server.ts`](../lib/supabase/server.ts),
guarded by `isValidAdminCookie` from [`lib/admin/passcode.ts`](../lib/admin/passcode.ts).
The page is a client component that `fetch`es that route (GET/POST/PUT/DELETE).
Delete is guarded against rows referenced by dependent tables (see the Series
route's registrations/league_tables/standings check).

**Pattern (portal, per-user reads):** replace the `getDemoUser()` +
`lib/data` call with the real session from [`lib/portal/session.ts`](../lib/portal/session.ts),
then query Supabase server-side (RLS scoped to the authenticated user). Each
`lib/data` function already documents the shape a real query should return, so
the swap can be done function-by-function without touching the pages.

## Suggested order

1. **Retire `getDemoUser()`** in the portal `(shell)` pages — point them at the
   real session. Unblocks correct per-user data everywhere downstream.
2. **Portal reads** (`getDashboardData`, `getOpenTables`, `getMyTables`,
   `getStandings`, `getAnnouncements`, …) → Supabase queries.
3. **Admin dashboard / tables / scores** → live queries (players/cities/series
   already done).
4. **Drop the `MOCK_REGISTRATIONS` fallback** in the players route once live data
   is guaranteed in every environment.
5. Delete [`lib/data/mock.ts`](../lib/data/mock.ts) + the mock shim once nothing imports it.
