// IndexedDB wrapper for offline storage
const DB_NAME = 'TruERPOfflineDB';
const DB_VERSION = 1;
const STORES = {
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  PRODUCTS: 'products',
  PARTIES: 'parties',
  SYNC_QUEUE: 'syncQueue',
  POS_SESSIONS: 'posSessions',
};

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.INVOICES)) {
          db.createObjectStore(STORES.INVOICES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
          db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PARTIES)) {
          db.createObjectStore(STORES.PARTIES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.POS_SESSIONS)) {
          db.createObjectStore(STORES.POS_SESSIONS, { keyPath: 'id' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) {
      await this.init();
    }
    const transaction = this.db!.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Generic CRUD operations
  async add(storeName: string, data: any): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.add(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName: string, data: any): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName: string, key: string): Promise<any> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName: string): Promise<any[]> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Specific operations for sync queue
  async addToSyncQueue(operation: string, entityType: string, entityData: any): Promise<void> {
    const queueItem = {
      id: crypto.randomUUID(),
      operation,
      entityType,
      entityData: JSON.stringify(entityData),
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await this.add(STORES.SYNC_QUEUE, queueItem);
  }

  async getPendingSyncs(): Promise<any[]> {
    const allItems = await this.getAll(STORES.SYNC_QUEUE);
    return allItems.filter((item) => item.status === 'pending');
  }

  async updateSyncStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    const item = await this.get(STORES.SYNC_QUEUE, id);
    if (item) {
      item.status = status;
      if (errorMessage) item.errorMessage = errorMessage;
      if (status === 'failed') item.retryCount = (item.retryCount || 0) + 1;
      await this.put(STORES.SYNC_QUEUE, item);
    }
  }

  async removeSyncedItems(ids: string[]): Promise<void> {
    const store = await this.getStore(STORES.SYNC_QUEUE, 'readwrite');
    for (const id of ids) {
      await this.delete(STORES.SYNC_QUEUE, id);
    }
  }

  // Product operations
  async cacheProducts(products: any[]): Promise<void> {
    await this.clear(STORES.PRODUCTS);
    for (const product of products) {
      await this.put(STORES.PRODUCTS, product);
    }
  }

  async getCachedProducts(): Promise<any[]> {
    return this.getAll(STORES.PRODUCTS);
  }

  // Party operations
  async cacheParties(parties: any[]): Promise<void> {
    await this.clear(STORES.PARTIES);
    for (const party of parties) {
      await this.put(STORES.PARTIES, party);
    }
  }

  async getCachedParties(): Promise<any[]> {
    return this.getAll(STORES.PARTIES);
  }

  // Invoice operations
  async saveOfflineInvoice(invoice: any): Promise<void> {
    await this.put(STORES.INVOICES, invoice);
    await this.addToSyncQueue('create', 'invoice', invoice);
  }

  async getOfflineInvoices(): Promise<any[]> {
    return this.getAll(STORES.INVOICES);
  }

  // Payment operations
  async saveOfflinePayment(payment: any): Promise<void> {
    await this.put(STORES.PAYMENTS, payment);
    await this.addToSyncQueue('create', 'payment', payment);
  }

  async getOfflinePayments(): Promise<any[]> {
    return this.getAll(STORES.PAYMENTS);
  }

  // POS Session operations
  async savePOSSession(session: any): Promise<void> {
    await this.put(STORES.POS_SESSIONS, session);
  }

  async getActivePOSSession(): Promise<any> {
    const sessions = await this.getAll(STORES.POS_SESSIONS);
    return sessions.find((s) => s.status === 'open');
  }

  async closePOSSession(sessionId: string): Promise<void> {
    const session = await this.get(STORES.POS_SESSIONS, sessionId);
    if (session) {
      session.status = 'closed';
      session.closedAt = new Date().toISOString();
      await this.put(STORES.POS_SESSIONS, session);
    }
  }
}

export const offlineStorage = new OfflineStorage();
