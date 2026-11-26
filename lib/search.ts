/** Lowercase and strip all whitespace, so "Kit Kat" and "kitkat" compare equal. */
export function compactSearch(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, '')
}

/**
 * Whitespace- and case-insensitive substring match: "Applejuice" matches
 * "Apple Juice" and "kit kat" matches "KitKat". An empty query matches.
 */
export function matchesSearch(text: string | null | undefined, query: string | null | undefined): boolean {
  const q = compactSearch(query)
  if (!q) return true
  return compactSearch(text).includes(q)
}
