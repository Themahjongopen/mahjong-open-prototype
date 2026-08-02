export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export type StateGroupableCity = { id: string; name: string; state: string | null };

export type StateGroup<T extends StateGroupableCity> = {
  stateLabel: string; // full name, or the raw value if not a known abbreviation, or "Other" if null
  cities: T[];
};

// Groups cities by full state name (alphabetical by that name), cities
// alphabetical by name within each group. Input order doesn't matter -
// this fully re-sorts. Falls back gracefully: an unrecognized abbreviation
// renders under its own raw value as the header; a null/empty state groups
// under "Other" at the end (kept out of the alphabetical sort so it doesn't
// land in the middle of the list).
export function groupCitiesByState<T extends StateGroupableCity>(cities: T[]): StateGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const city of cities) {
    const raw = city.state?.trim();
    const label = raw ? (STATE_NAMES[raw.toUpperCase()] ?? raw) : "Other";
    const bucket = buckets.get(label) ?? [];
    bucket.push(city);
    buckets.set(label, bucket);
  }
  const labels = [...buckets.keys()].sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });
  return labels.map((stateLabel) => ({
    stateLabel,
    cities: [...buckets.get(stateLabel)!].sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
