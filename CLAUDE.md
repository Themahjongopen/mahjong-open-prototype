@AGENTS.md

# Database & migrations

## View rewrites
When rewriting a view with CREATE OR REPLACE VIEW, diff the new
definition against the most recent prior migration that defined it,
clause by clause. Filters added in earlier migrations are silently
dropped by a rewrite — nothing errors and no test fails.
Report which clauses were carried forward and which were
intentionally dropped.

Known instance: migration 016 filtered the standings views by
show_in_directory. Migration 027 (Ace/Champion rewrite) recreated
them without it. The filter has been absent since, through 028, 030,
and 032, unnoticed.

## Migration numbering
Before creating a migration, run `ls supabase/migrations` and use the
next unused number. Do not infer the number from which migration last
touched the relevant object — production is often well ahead of it.

Known instance: a Flight Winner fix was numbered 034 because 032 was
the last migration to touch member_series_standings, colliding with
the already-applied 034_table_invites. Production was at 040; the
correct number was 041.

# Capacity math

Table capacity (active seats + live holds) is computed in `claim_seat`
(044), `TableDetailClient`, `OpenTableCard`, and `/api/admin/tables`.
If the rule changes, all four must change together. In particular, the
viewer's own hold must be excluded when deciding whether *that viewer*
can join — `claim_seat` and `TableDetailClient` do this; `OpenTableCard`
did not, which made held tables unjoinable for the exact person they
were held for.
