const DB_NAME = "chatley-identity"
const SECRET_STORE = "secrets"
const VERIFIED_STORE = "verified"
const DB_VERSION = 2

export type VerifiedPeer = {
  peerId: string
  peerPubKey: string
  localPubKey: string
  verifiedAt: number
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SECRET_STORE)) db.createObjectStore(SECRET_STORE)
      if (!db.objectStoreNames.contains(VERIFIED_STORE)) db.createObjectStore(VERIFIED_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Could not open identity store"))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const request = fn(tx.objectStore(storeName))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error("Identity store failed"))
    })
  } finally {
    db.close()
  }
}

function verifiedKey(localUserId: string, peerId: string) {
  return `${localUserId}:${peerId}`
}

export async function loadIdentitySecret(userId: string) {
  const value = await withStore(SECRET_STORE, "readonly", (store) => store.get(userId))
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
  await withStore(SECRET_STORE, "readwrite", (store) => store.put(copy, userId))
}

export async function clearIdentitySecret(userId: string) {
  await withStore(SECRET_STORE, "readwrite", (store) => store.delete(userId))
}

export async function loadVerifiedPeer(localUserId: string, peerId: string) {
  const value = await withStore(VERIFIED_STORE, "readonly", (store) =>
    store.get(verifiedKey(localUserId, peerId)),
  )
  if (!value || typeof value !== "object") return null
  const record = value as Partial<VerifiedPeer>
  if (
    typeof record.peerId !== "string" ||
    typeof record.peerPubKey !== "string" ||
    typeof record.localPubKey !== "string" ||
    typeof record.verifiedAt !== "number"
  ) {
    return null
  }
  return record as VerifiedPeer
}

export async function saveVerifiedPeer(localUserId: string, record: VerifiedPeer) {
  await withStore(VERIFIED_STORE, "readwrite", (store) =>
    store.put(record, verifiedKey(localUserId, record.peerId)),
  )
}

export async function clearVerifiedPeer(localUserId: string, peerId: string) {
  await withStore(VERIFIED_STORE, "readwrite", (store) =>
    store.delete(verifiedKey(localUserId, peerId)),
  )
}
