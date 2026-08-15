const DB_NAME = "chatley-identity"
const STORE = "secrets"
const DB_VERSION = 1

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Could not open identity store"))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = fn(tx.objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error("Identity store failed"))
    })
  } finally {
    db.close()
  }
}

export async function loadIdentitySecret(userId: string) {
  const value = await withStore("readonly", (store) => store.get(userId))
  const bytes =
    value instanceof Uint8Array
      ? new Uint8Array(value)
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : null
  return bytes?.length === 32 ? bytes : null
}

export async function saveIdentitySecret(userId: string, secret: Uint8Array) {
  const copy = new Uint8Array(secret)
  await withStore("readwrite", (store) => store.put(copy, userId))
}

export async function clearIdentitySecret(userId: string) {
  await withStore("readwrite", (store) => store.delete(userId))
}
