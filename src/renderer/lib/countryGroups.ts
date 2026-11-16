/** Shared by categories, search, recent items and startup. Keep persisted country codes. */
export function countryCodeFromText(value: string): string | null {
  const text = value.trim().toUpperCase().replace(/^[\s\[({|:·•★]+/, "");
  if (/^(?:ASIA|ASIAN|AZI[EË])(?=$|[\s\]|:._-])/.test(text)) return "ASIA";
  if (/^(?:EX[\s_-]*(?:YU|U|YUGOSLAVIA)|EXXIU|EXXU)(?=$|[\s\]|:._-])/.test(text)) return "EX-YU";
  const match = text.match(/^([A-Z]{2,3})(?=$|\s|[\]|:._-])/);
  return match ? match[1] : null;
}

/** Upgrade a legacy "hide almost every country" selection without changing an explicit new choice. */
export function migrateRegionFilters(names: string[], hidden: string[], version = 0): string[] {
  if (version >= 2 || hidden.length < 4) return hidden;
  const all = new Set(names.map(countryCodeFromText).filter((x): x is string => Boolean(x)));
  const legacy = [...all].filter((x) => x !== "ASIA" && x !== "EX-YU");
  if (legacy.length === 0 || legacy.filter((x) => hidden.includes(x)).length / legacy.length < 0.75) return hidden;
  return [...new Set([...hidden, ...["ASIA", "EX-YU"].filter((x) => all.has(x))])].sort();
}
