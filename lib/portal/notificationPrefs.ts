// Canonical notification preferences. The DB column
// profiles.notification_preferences is a free-form JSONB bag; the app owns the
// key list + defaults so new types can be added here without a migration.
// Stored values are treated as overrides merged over these defaults.

export type NotificationPrefKey =
  | "email_table_reminders"
  | "email_score_posted"
  | "email_series_updates"
  | "email_new_tables"
  | "email_table_filled";

export const NOTIFICATION_PREFS: {
  key: NotificationPrefKey;
  label: string;
  description: string;
  default: boolean;
}[] = [
  {
    key: "email_table_reminders",
    label: "Table reminders",
    description: "Email me before a table I'm seated at.",
    default: true,
  },
  {
    key: "email_score_posted",
    label: "Scores posted",
    description: "Email me when scores are submitted for a table I played.",
    default: true,
  },
  {
    key: "email_series_updates",
    label: "League updates",
    description: "Occasional announcements about my current league.",
    default: true,
  },
  {
    // Opt-IN by default (false): fires once per new table to every opted-in paid
    // player in the city, so in a busy city this is the highest-volume type —
    // defaulted off so players choose it rather than being auto-subscribed.
    key: "email_new_tables",
    label: "New tables",
    description: "Email me when a new table opens in my city.",
    default: false,
  },
  {
    // Low volume (once per table, on the 4th-seat transition) — opt-out like the
    // other three.
    key: "email_table_filled",
    label: "Table filled",
    description: "Email me when a table I'm seated at fills up.",
    default: true,
  },
];

export type ResolvedPrefs = Record<NotificationPrefKey, boolean>;

// Merge stored overrides over the canonical defaults, ignoring unknown/legacy
// keys so removing a type here never breaks reads.
export function resolvePrefs(stored: unknown): ResolvedPrefs {
  const bag = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const out = {} as ResolvedPrefs;
  for (const pref of NOTIFICATION_PREFS) {
    const v = bag[pref.key];
    out[pref.key] = typeof v === "boolean" ? v : pref.default;
  }
  return out;
}

// Keep only known boolean keys before persisting.
export function sanitizePrefs(input: unknown): ResolvedPrefs {
  return resolvePrefs(input);
}
