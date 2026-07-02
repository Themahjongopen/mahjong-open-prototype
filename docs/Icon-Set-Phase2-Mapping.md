# Brand Icon Set → Phase 2 Portal Mapping

_Created 2026-07-01. Reference for where each two-tone brand icon (`~/Downloads/brand-assets/icons`) gets used in the Phase 2 portal. The portal bottom-tab nav currently uses generic lucide icons — Phase 2 can swap these for the branded set for a consistent look._

## Already in use (Phase 1)
| Icon | Where |
|---|---|
| `rsvp.svg` | Registration success confirmation screen (also fits "your seat / joined a table" in the portal — see below) |
| `clock.svg` | Payment-not-complete / pending confirmation (new icon; also fits the portal "Complete payment" screen) |
| `chat.svg` | Contact form submitted confirmation |
| `invite.svg` | Commissioner application submitted confirmation |
| `email.svg` | Transactional email templates / contact |

## Portal bottom-tab nav (swap lucide → brand icons)
Current tabs (lucide): Home, Standings, Schedule, Scores, Directory.
| Tab (route) | Brand icon | Note |
|---|---|---|
| Home (`/portal`) | `home.svg` | |
| Standings (`/portal/standings`) | `standings.svg` | tab glyph; `trophy` reserved for the winner badge |
| Schedule (`/portal/tables`) | `calendar.svg` | |
| Scores (`/portal/scores`) | `submit-score.svg` | |
| Directory (`/portal/directory`) | `profile.svg` *(or new "members/group" icon — see gaps)* | set only has a single-person icon |

## Other portal screens / components
| Screen or element | Brand icon |
|---|---|
| My Tables (`/portal/my-tables`) — your reserved seats | `rsvp.svg` (seat confirmed) or `tile.svg` |
| Table detail (`/portal/tables/[id]`) | `tile.svg` (the table) + `calendar.svg` on the **Add to Calendar** button |
| Create Table (`/portal/tables/create`) | `tile.svg` |
| Complete Payment (`/portal/payment`) | `clock.svg` (pending, consistent with the cancelled screen) |
| Player Profile (`/portal/profile/[id]`) | `profile.svg` |
| Standings — top finisher / winner badge | `trophy.svg` |
| Standings — weekly top scores / leaderboard block | `leaderboard.svg` |
| Standings/score rows — points values | `points.svg` |
| Submit Score action | `submit-score.svg` |
| Directory / tables search field | `search.svg` |
| Mobile "more" / overflow | `menu.svg` |
| Share a table link / share standings | `share.svg` |
| "Register for next series" nudge (portal) + marketing register | `register.svg` |

## Not needed in the portal (repurpose or park)
- `announcement.svg` — the portal announcements/alerts feature was **removed from scope** (see redesign scope in `project_specs.md`). Repurpose for a marketing-homepage announcement or an admin notice, or park it.

## Gaps to fill in Phase 2
- **Directory "members/group" icon** — the set only has a single-person `profile.svg`. The Directory tab (a member roster) reads better with a group/people icon. Either add one in the same two-tone style, or reuse `profile.svg` for now.
- Otherwise the set covers the portal well; no other new icons anticipated.

## How they'll be used (consistency note)
Same treatment as the confirmation screens: inline the SVG (stroke inherits navy via `currentColor`), pink fill layer intact. For nav tabs, size ~22–24px and let the active/inactive color come from the tab state; for headers/badges, wrap in the soft-pink circle where a feature icon is wanted.
