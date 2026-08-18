/** Pre-seeded catch-all vendor for purchase invoices. */
export const DEFAULT_VENDOR_NAME = 'General Vendor'

export function isDefaultVendorName(name: string | undefined | null): boolean {
  return (name ?? '').trim().toLowerCase() === DEFAULT_VENDOR_NAME.toLowerCase()
}

export function pickDefaultVendor<T extends { id: string; name: string }>(
  vendors: T[] | undefined | null
): T | undefined {
  if (!vendors?.length) return undefined
  return vendors.find((v) => isDefaultVendorName(v.name))
}
