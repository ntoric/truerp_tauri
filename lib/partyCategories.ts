export const DEFAULT_PARTY_CATEGORIES = ['Retail', 'Wholesale']

export function mergePartyCategories(existing: string[] = []): string[] {
  return Array.from(
    new Set([...DEFAULT_PARTY_CATEGORIES, ...existing.filter(Boolean)])
  ).sort((a, b) => a.localeCompare(b))
}
