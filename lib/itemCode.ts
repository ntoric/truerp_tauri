import { apiFetch } from '@/hooks/useAuth'

export interface ItemCodeDuplicateProduct {
  id: string
  name: string
  sku: string
  item_code: string
}

export interface ItemCodeLookupResult {
  exists: boolean
  products: ItemCodeDuplicateProduct[]
}

export async function generateUniqueItemCode(unit: string): Promise<string> {
  const res = await apiFetch(`/products/generate-item-code?unit=${encodeURIComponent(unit || 'PCS')}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to generate item code'
    )
  }
  const data = (await res.json()) as { item_code?: string }
  const code = data.item_code?.trim()
  if (!code) {
    throw new Error('Failed to generate item code')
  }
  return code
}

export async function lookupProductsByItemCode(
  itemCode: string
): Promise<ItemCodeLookupResult> {
  const code = itemCode.trim()
  if (!code) {
    return { exists: false, products: [] }
  }

  const res = await apiFetch(
    `/products/check-item-code?item_code=${encodeURIComponent(code)}`
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to validate item code'
    )
  }

  const data = (await res.json()) as {
    exists?: boolean
    products?: Array<{
      id?: string
      name?: string
      sku?: string
      item_code?: string
    }>
  }

  const products = (data.products ?? [])
    .map((product) => ({
      id: String(product.id ?? ''),
      name: String(product.name ?? ''),
      sku: String(product.sku ?? ''),
      item_code: String(product.item_code ?? code),
    }))
    .filter((product) => product.id && product.name)

  return {
    exists: Boolean(data.exists) && products.length > 0,
    products,
  }
}

export async function fetchNextProductPlu(): Promise<string> {
  const res = await apiFetch('/products/next-plu')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to fetch next PLU')
  }
  const data = (await res.json()) as { plu?: string }
  const plu = data.plu?.trim()
  if (!plu) {
    throw new Error('Failed to fetch next PLU')
  }
  return plu
}

export async function lookupProductsByPlu(
  plu: string
): Promise<ItemCodeLookupResult> {
  const code = plu.trim()
  if (!code) {
    return { exists: false, products: [] }
  }

  const res = await apiFetch(`/products/check-plu?plu=${encodeURIComponent(code)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to validate PLU')
  }

  const data = (await res.json()) as {
    exists?: boolean
    products?: Array<{
      id?: string
      name?: string
      sku?: string
      item_code?: string
    }>
  }

  const products = (data.products ?? [])
    .map((product) => ({
      id: String(product.id ?? ''),
      name: String(product.name ?? ''),
      sku: String(product.sku ?? ''),
      item_code: String(product.item_code ?? ''),
    }))
    .filter((product) => product.id && product.name)

  return {
    exists: Boolean(data.exists) && products.length > 0,
    products,
  }
}
