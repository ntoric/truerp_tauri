import {
  desktopPosQueueListUnsynced,
  desktopPosQueueRequeueFailed,
  desktopPosQueueUpdateStatus,
  desktopPosQueueUpsert,
  hasDesktopPosQueue,
  parseDesktopPosSalePayload,
  shouldRetryDesktopPosQueue,
} from '@/lib/desktopPosQueue'

export const POS_META_KEYS = {
  INVOICE_CURSOR: 'invoice_cursor',
  PRINT_SETTINGS: 'print_settings',
  BUSINESS: 'business',
  LOYALTY: 'loyalty_settings',
  PAYMENT_MAPPINGS: 'payment_mappings',
  BANK_ACCOUNTS: 'bank_accounts',
} as const

export interface InvoiceCursor {
  prefix: string
  next: number
}

export interface POSSaleRecord {
  id: string
  client_sale_id: string
  invoice_number: string
  party_id: string
  party?: {
    id: string
    name: string
    phone?: string
    gstin?: string
    local_only?: boolean
  }
  date: string
  status: string
  payment_mode: string
  amount_paid: number
  is_pos: true
  pos_session_id?: string
  session_local_only?: boolean
  session_opening_cash?: number
  invoice_discount?: number
  loyalty_points_redeemed?: number
  items: Array<{
    product_id: string
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    unit: string
    batch_no?: string
    exp_date?: string | null
    total?: number
  }>
  tax_total?: number
  round_off?: number
  total?: number
  sync_status: 'pending_sync' | 'synced' | 'failed'
  server_id?: string
  server_invoice_number?: string
  error_message?: string
}

type MetaRow = { key: string; value: unknown }

const DB_NAME = 'TruERPOfflineDB'
const DB_VERSION = 2
const STORES = {
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  PRODUCTS: 'products',
  PARTIES: 'parties',
  SYNC_QUEUE: 'syncQueue',
  POS_SESSIONS: 'posSessions',
  BATCHES: 'batches',
  META: 'meta',
  DRAFTS: 'posDrafts',
}

function sqliteStatus(status?: string): 'pending' | 'failed' | 'synced' {
  if (status === 'failed') return 'failed'
  if (status === 'synced') return 'synced'
  return 'pending'
}

function parseQueuedSale(item: { entityData?: unknown; id?: string }): POSSaleRecord | null {
  try {
    const data = typeof item.entityData === 'string' ? JSON.parse(item.entityData) : item.entityData
    if (!data || typeof data !== 'object') return null
    const sale = data as POSSaleRecord
    const id = sale.client_sale_id || sale.id || item.id
    if (!id) return null
    return { ...sale, id, client_sale_id: id }
  } catch {
    return null
  }
}

class OfflineStorage {
  private db: IDBDatabase | null = null
  private opening: Promise<void> | null = null
  private hydratedDesktopQueue = false

  async init(): Promise<void> {
    if (this.opening) {
      await this.opening
      return
    }
    if (this.db) {
      if (!this.hydratedDesktopQueue) {
        this.opening = this.hydrateFromDesktopQueue()
        try {
          await this.opening
        } finally {
          this.opening = null
        }
      }
      return
    }

    this.opening = (async () => {
      await this.openIndexedDb()
      await this.hydrateFromDesktopQueue()
    })()
    try {
      await this.opening
    } finally {
      this.opening = null
    }
  }

  private openIndexedDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(request.error)
      }
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORES.INVOICES)) {
          db.createObjectStore(STORES.INVOICES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
          db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.PARTIES)) {
          db.createObjectStore(STORES.PARTIES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' })
          syncStore.createIndex('status', 'status', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORES.POS_SESSIONS)) {
          db.createObjectStore(STORES.POS_SESSIONS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.BATCHES)) {
          const batchStore = db.createObjectStore(STORES.BATCHES, { keyPath: 'id' })
          batchStore.createIndex('product_id', 'product_id', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
          db.createObjectStore(STORES.DRAFTS, { keyPath: 'id' })
        }
      }
    })
  }

  private async hydrateFromDesktopQueue(): Promise<void> {
    if (this.hydratedDesktopQueue) return
    if (!hasDesktopPosQueue()) {
      if (!shouldRetryDesktopPosQueue()) {
        this.hydratedDesktopQueue = true
      }
      return
    }

    try {
      const localUnsynced = await this.getUnsynced()
      for (const item of localUnsynced) {
        if (item.entityType !== 'pos_sale' && item.entityType !== 'invoice') continue
        const sale = parseQueuedSale(item)
        if (sale) {
          await desktopPosQueueUpsert(sale, sqliteStatus(item.status), item.errorMessage)
        }
      }

      const rows = await desktopPosQueueListUnsynced()
      for (const row of rows) {
        const parsed = parseDesktopPosSalePayload(row.payload)
        if (!parsed) continue
        const id = parsed.client_sale_id || parsed.id || row.clientSaleId
        if (!id) continue
        const sale = {
          ...parsed,
          id,
          client_sale_id: id,
          sync_status: row.status === 'failed' ? 'failed' : 'pending_sync',
          error_message: row.errorMessage || parsed.error_message,
        } as POSSaleRecord
        await this.put(STORES.INVOICES, sale)
        await this.put(STORES.SYNC_QUEUE, {
          id,
          operation: 'create',
          entityType: 'pos_sale',
          entityData: JSON.stringify(sale),
          status: row.status === 'failed' ? 'failed' : 'pending',
          createdAt: new Date().toISOString(),
          retryCount: 0,
          errorMessage: row.errorMessage || undefined,
        })
      }
    } catch (err) {
      console.warn('Desktop POS queue hydrate failed:', err)
    } finally {
      this.hydratedDesktopQueue = true
    }
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) {
      await this.init()
    }
    const transaction = this.db!.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  async add(storeName: string, data: unknown): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.add(data)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async put(storeName: string, data: unknown): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(data)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async get(storeName: string, key: string): Promise<any> {
    const store = await this.getStore(storeName, 'readonly')
    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getAll(storeName: string): Promise<any[]> {
    const store = await this.getStore(storeName, 'readonly')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async delete(storeName: string, key: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clear(storeName: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.put(STORES.META, { key, value } satisfies MetaRow)
  }

  async getMeta<T = unknown>(key: string): Promise<T | null> {
    const row = (await this.get(STORES.META, key)) as MetaRow | undefined
    return (row?.value as T) ?? null
  }

  async addToSyncQueue(operation: string, entityType: string, entityData: unknown, id?: string): Promise<void> {
    const queueItem = {
      id: id || crypto.randomUUID(),
      operation,
      entityType,
      entityData: typeof entityData === 'string' ? entityData : JSON.stringify(entityData),
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }
    await this.put(STORES.SYNC_QUEUE, queueItem)
  }

  async getPendingSyncs(): Promise<any[]> {
    const allItems = await this.getAll(STORES.SYNC_QUEUE)
    return allItems
      .filter((item) => item.status === 'pending')
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  }

  async getUnsynced(): Promise<any[]> {
    const allItems = await this.getAll(STORES.SYNC_QUEUE)
    return allItems.filter((item) => item.status === 'pending' || item.status === 'failed')
  }

  async getFailedSyncCount(): Promise<number> {
    const allItems = await this.getAll(STORES.SYNC_QUEUE)
    return allItems.filter((item) => item.status === 'failed').length
  }

  async updateSyncStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    const item = await this.get(STORES.SYNC_QUEUE, id)
    if (item) {
      item.status = status
      if (errorMessage) item.errorMessage = errorMessage
      if (status === 'failed') item.retryCount = (item.retryCount || 0) + 1
      await this.put(STORES.SYNC_QUEUE, item)
    }
    const sale = ((await this.get(STORES.INVOICES, id)) as POSSaleRecord | undefined) || parseQueuedSale(item || {})
    if (sale) {
      sale.sync_status = status === 'failed' ? 'failed' : status === 'synced' ? 'synced' : 'pending_sync'
      if (errorMessage) sale.error_message = errorMessage
      await desktopPosQueueUpsert(sale, sqliteStatus(status), errorMessage)
    } else {
      await desktopPosQueueUpdateStatus(id, sqliteStatus(status), errorMessage)
    }
  }

  async removeSyncedItems(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(STORES.SYNC_QUEUE, id)
    }
  }

  async hasPendingPOSSales(): Promise<boolean> {
    try {
      const unsynced = await this.getUnsynced()
      return unsynced.some((item) => item.entityType === 'pos_sale' || item.entityType === 'invoice')
    } catch {
      return false
    }
  }

  async requeueFailedSyncs(): Promise<void> {
    const allItems = await this.getAll(STORES.SYNC_QUEUE)
    for (const item of allItems) {
      if (item.status === 'failed') {
        item.status = 'pending'
        await this.put(STORES.SYNC_QUEUE, item)
      }
    }
    await desktopPosQueueRequeueFailed()
  }

  async cacheProducts(products: any[]): Promise<void> {
    await this.clear(STORES.PRODUCTS)
    for (const product of products) {
      if (product?.id) await this.put(STORES.PRODUCTS, product)
    }
  }

  async getCachedProducts(): Promise<any[]> {
    return this.getAll(STORES.PRODUCTS)
  }

  async putProduct(product: any): Promise<void> {
    if (product?.id) await this.put(STORES.PRODUCTS, product)
  }

  async cacheParties(parties: any[]): Promise<void> {
    await this.clear(STORES.PARTIES)
    for (const party of parties) {
      if (party?.id) await this.put(STORES.PARTIES, party)
    }
  }

  async getCachedParties(): Promise<any[]> {
    return this.getAll(STORES.PARTIES)
  }

  async putParty(party: any): Promise<void> {
    if (party?.id) await this.put(STORES.PARTIES, party)
  }

  async cacheBatches(batches: any[]): Promise<void> {
    await this.clear(STORES.BATCHES)
    for (const batch of batches) {
      if (batch?.id) await this.put(STORES.BATCHES, batch)
    }
  }

  async getCachedBatches(): Promise<any[]> {
    return this.getAll(STORES.BATCHES)
  }

  async getCachedBatchesForProduct(productId: string): Promise<any[]> {
    const all = await this.getCachedBatches()
    return all
      .filter((batch) => String(batch.product_id) === String(productId) && Number(batch.available_qty ?? 0) > 0)
      .sort((a, b) => {
        const aExp = a.exp_date ? new Date(a.exp_date).getTime() : Number.POSITIVE_INFINITY
        const bExp = b.exp_date ? new Date(b.exp_date).getTime() : Number.POSITIVE_INFINITY
        return aExp - bExp
      })
  }

  async decrementLocalStock(productId: string, quantity: number, batchNo?: string): Promise<void> {
    const product = await this.get(STORES.PRODUCTS, productId)
    if (product) {
      product.stock_qty = Math.max(0, Number(product.stock_qty || 0) - quantity)
      await this.put(STORES.PRODUCTS, product)
    }
    if (!batchNo) return
    const batches = await this.getCachedBatches()
    const match = batches.find(
      (batch) => String(batch.product_id) === String(productId) && String(batch.batch_no || '') === String(batchNo)
    )
    if (match) {
      match.available_qty = Math.max(0, Number(match.available_qty || 0) - quantity)
      match.quantity = Math.max(0, Number(match.quantity || 0) - quantity)
      await this.put(STORES.BATCHES, match)
    }
  }

  async savePendingPOSSale(sale: POSSaleRecord): Promise<void> {
    await this.put(STORES.INVOICES, sale)
    await this.addToSyncQueue('create', 'pos_sale', sale, sale.client_sale_id)
    await desktopPosQueueUpsert(sale, 'pending')
  }

  async markPOSSaleSynced(clientSaleId: string, serverInvoice: { id?: string; invoice_number?: string }): Promise<void> {
    const sale = (await this.get(STORES.INVOICES, clientSaleId)) as POSSaleRecord | undefined
    if (sale) {
      sale.sync_status = 'synced'
      sale.server_id = serverInvoice.id
      sale.server_invoice_number = serverInvoice.invoice_number
      await this.put(STORES.INVOICES, sale)
      await desktopPosQueueUpsert(sale, 'synced')
    } else {
      await desktopPosQueueUpdateStatus(clientSaleId, 'synced')
    }
    await this.delete(STORES.SYNC_QUEUE, clientSaleId)
  }

  async markPOSSaleFailed(clientSaleId: string, errorMessage: string): Promise<void> {
    const sale = (await this.get(STORES.INVOICES, clientSaleId)) as POSSaleRecord | undefined
    if (sale) {
      sale.sync_status = 'failed'
      sale.error_message = errorMessage
      await this.put(STORES.INVOICES, sale)
      await desktopPosQueueUpsert(sale, 'failed', errorMessage)
    }
    await this.updateSyncStatus(clientSaleId, 'failed', errorMessage)
  }

  async saveOfflineInvoice(invoice: any): Promise<void> {
    const id = invoice.id || invoice.client_sale_id || crypto.randomUUID()
    await this.put(STORES.INVOICES, { ...invoice, id })
  }

  async getOfflineInvoices(): Promise<any[]> {
    return this.getAll(STORES.INVOICES)
  }

  async saveOfflinePayment(payment: any): Promise<void> {
    await this.put(STORES.PAYMENTS, payment)
    await this.addToSyncQueue('create', 'payment', payment)
  }

  async getOfflinePayments(): Promise<any[]> {
    return this.getAll(STORES.PAYMENTS)
  }

  async savePOSSession(session: any): Promise<void> {
    await this.put(STORES.POS_SESSIONS, session)
  }

  async getActivePOSSession(): Promise<any> {
    const sessions = await this.getAll(STORES.POS_SESSIONS)
    return sessions.find((s) => s.status === 'open')
  }

  async remapPOSSessionId(fromId: string, toId: string): Promise<void> {
    if (!fromId || !toId || fromId === toId) return
    const session = await this.get(STORES.POS_SESSIONS, fromId)
    if (session) {
      await this.delete(STORES.POS_SESSIONS, fromId)
      await this.put(STORES.POS_SESSIONS, { ...session, id: toId, local_only: false })
    }

    const invoices = await this.getAll(STORES.INVOICES)
    for (const invoice of invoices) {
      if (invoice.pos_session_id === fromId) {
        invoice.pos_session_id = toId
        invoice.session_local_only = false
        await this.put(STORES.INVOICES, invoice)
        if (invoice.sync_status !== 'synced') {
          await desktopPosQueueUpsert(invoice, sqliteStatus(invoice.sync_status))
        }
      }
    }

    const queue = await this.getAll(STORES.SYNC_QUEUE)
    for (const item of queue) {
      try {
        const data = typeof item.entityData === 'string' ? JSON.parse(item.entityData) : item.entityData
        if (data?.pos_session_id === fromId) {
          data.pos_session_id = toId
          data.session_local_only = false
          item.entityData = JSON.stringify(data)
          await this.put(STORES.SYNC_QUEUE, item)
          const sale = parseQueuedSale(item)
          if (sale) await desktopPosQueueUpsert(sale, sqliteStatus(item.status), item.errorMessage)
        }
      } catch {
        /* ignore malformed queue rows */
      }
    }
  }

  async clearOpenPOSSessions(): Promise<void> {
    const sessions = await this.getAll(STORES.POS_SESSIONS)
    for (const session of sessions) {
      if (session.status === 'open') {
        await this.delete(STORES.POS_SESSIONS, session.id)
      }
    }
  }

  async closePOSSession(sessionId: string): Promise<void> {
    const session = await this.get(STORES.POS_SESSIONS, sessionId)
    if (session) {
      session.status = 'closed'
      session.closedAt = new Date().toISOString()
      await this.put(STORES.POS_SESSIONS, session)
    }
  }

  parseInvoiceCursor(invoiceNumber: string): InvoiceCursor {
    const raw = String(invoiceNumber || '').trim()
    const match = raw.match(/^(.*?)[-_]?(\d+)$/)
    if (!match) return { prefix: 'INV', next: 1 }
    return {
      prefix: match[1].replace(/[-_]$/, '') || 'INV',
      next: parseInt(match[2], 10) || 1,
    }
  }

  async seedInvoiceCursor(invoiceNumber: string): Promise<void> {
    await this.setMeta(POS_META_KEYS.INVOICE_CURSOR, this.parseInvoiceCursor(invoiceNumber))
  }

  async allocateInvoiceNumber(): Promise<string> {
    const cursor = (await this.getMeta<InvoiceCursor>(POS_META_KEYS.INVOICE_CURSOR)) || {
      prefix: 'INV',
      next: 1,
    }
    const number = `${cursor.prefix}-${String(cursor.next).padStart(4, '0')}`
    await this.setMeta(POS_META_KEYS.INVOICE_CURSOR, { ...cursor, next: cursor.next + 1 })
    return number
  }

  async saveLocalDraft(draft: any): Promise<void> {
    if (draft?.id) await this.put(STORES.DRAFTS, draft)
  }

  async getLocalDrafts(): Promise<any[]> {
    return this.getAll(STORES.DRAFTS)
  }
}

export const offlineStorage = new OfflineStorage()
