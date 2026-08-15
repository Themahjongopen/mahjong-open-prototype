// Shared normalization for a table's free-text "area" (part of town). Used by
// BOTH the create path and the edit path so the two can never diverge — this is
// what collapses the most common duplicates ("  north   shelby ", "NORTH SHELBY",
// "north shelby" all become "North Shelby") with no human intervention.
//
// Pure + import-free so it's safe in server routes and the client bundle alike.
//
// Returns null for empty / whitespace-only input: the column is nullable and an
// absent area must store as NULL, never as "".
export function normalizeArea(input: string | null | undefined): string | null {
  if (input == null) return null;
  const collapsed = input.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  return collapsed
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
