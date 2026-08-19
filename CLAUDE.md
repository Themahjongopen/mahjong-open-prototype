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
