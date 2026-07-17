// Canonical notification preferences. The DB column
// profiles.notification_preferences is a free-form JSONB bag; the app owns the
// key list + defaults so new types can be added here without a migration.
// Stored values are treated as overrides merged over these defaults.

export type NotificationPrefKey =
  | "email_table_reminders"
  | "email_score_posted"
  | "email_series_updates";

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
    label: "Series updates",
    description: "Occasional announcements about my current series.",
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
