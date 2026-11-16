import type { CategoryPreferences } from "../../shared/settings";

export type CategoryEntry = { key: string; name: string; countryHidden?: boolean };
export const emptyCategoryPreferences: CategoryPreferences = { hidden: [], order: [] };

export function orderCategories<T extends { key: string }>(categories: T[], order: string[] = []): T[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  return categories.map((item, index) => ({ item, index })).sort((a, b) =>
    (rank.get(a.item.key) ?? order.length + a.index) - (rank.get(b.item.key) ?? order.length + b.index)
  ).map(({ item }) => item);
}

/** Move selected categories as a stable group; leave other categories in their relative order. */
export function moveCategories(order: string[], selected: Set<string>, direction: "up" | "down" | "top" | "bottom"): string[] {
  if (direction === "top" || direction === "bottom") {
    const picked = order.filter((key) => selected.has(key));
    const rest = order.filter((key) => !selected.has(key));
    return direction === "top" ? [...picked, ...rest] : [...rest, ...picked];
  }
  const next = [...order];
  if (direction === "up") {
    for (let i = 1; i < next.length; i++) if (selected.has(next[i]) && !selected.has(next[i - 1])) [next[i - 1], next[i]] = [next[i], next[i - 1]];
  } else {
    for (let i = next.length - 2; i >= 0; i--) if (selected.has(next[i]) && !selected.has(next[i + 1])) [next[i + 1], next[i]] = [next[i], next[i + 1]];
  }
  return next;
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchesSearch(name: string, group: string, query: string): boolean {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const text = `${normalizeSearch(name)} ${normalizeSearch(group)}`;
  return tokens.every((token) => text.includes(token));
}
