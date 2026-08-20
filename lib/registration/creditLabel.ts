// Single source of truth for how a registration's attribution reads to a human —
// shared by the commissioner roster (Part 1) and the new-registration email
// (Part 2) so the two never drift. Attribution is multi-valued (one row per
// commissioner; a split-commission city credits two), so this collapses the list
// of commissioner names into one label and covers all four states:
//   1+ names        → "Sandy Faulkner" / "Sandy Faulkner & Vicki Campbell"
//   no names, paid  → "Unattributed"  (a paid signup that was never credited)
//   no names, other → "Pending"       (an unpaid registration — not yet settled)
// "no names" covers both a missing attribution row and a NULL-commissioner row
// (the genuinely-unattributed record a zero-commissioner city writes) — neither
// carries a name, and both should read the same to a commissioner.
export function formatCreditedTo(names: (string | null | undefined)[], paidStatus: string): string {
  const clean = names.filter((n): n is string => !!n && n.trim().length > 0);
  if (clean.length === 0) return paidStatus === "paid" ? "Unattributed" : "Pending";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  // 3+ — Oxford-style "A, B & C" so a shared credit is never ambiguous.
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
}
