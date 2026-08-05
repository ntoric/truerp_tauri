/** Pre-seeded catch-all category for products and expenses (separate catalogs). */
export const DEFAULT_CATEGORY_NAME = 'General'

export function pickDefaultCategoryName(
  categories: Array<{ name: string }> | undefined | null,
  fallback = DEFAULT_CATEGORY_NAME
): string {
  if (!categories?.length) return fallback
  const match = categories.find(
    (c) => c.name.trim().toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()
  )
  return match?.name ?? fallback
}
