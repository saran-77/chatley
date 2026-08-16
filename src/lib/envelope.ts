import {
  b64ToBytes,
  bytesToB64,
  decryptBytes,
  decryptText,
  encryptBytes,
  encryptText,
  generateConversationKey,
  identityPublicKey,
  unwrapConversationKey,
  wrapConversationKey,
} from "@/lib/crypto"
import { supabase } from "@/lib/supabase"
import type { Payload } from "@/lib/payload"
import { parsePayload, serializePayload } from "@/lib/payload"

const keyCache = new Map<string, Uint8Array>()

function cacheKey(conversationId: string, epoch: number) {
  return `${conversationId}:${epoch}`
}

export function clearConversationKeyCache() {
  keyCache.clear()
}

function rememberKey(conversationId: string, epoch: number, key: Uint8Array) {
  keyCache.set(cacheKey(conversationId, epoch), key)
  return key
}

export async function getCachedOrUnwrappedKey(
  conversationId: string,
  epoch: number,
  identitySecret: Uint8Array,
  wrappedKey?: string | null,
) {
  const cached = keyCache.get(cacheKey(conversationId, epoch))
  if (cached) return cached
  if (!wrappedKey) return null
  const key = unwrapConversationKey(identitySecret, wrappedKey)
  return rememberKey(conversationId, epoch, key)
}

async function fetchMyWrap(conversationId: string, userId: string, epoch: number) {
  const { data, error } = await supabase
    .from("conversation_keys")
    .select("wrapped_key")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("epoch", epoch)
    .maybeSingle()
  if (error) throw error
  return data?.wrapped_key ?? null
}

async function fetchJoinedMembers(conversationId: string) {
  const { data: members, error } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("status", "joined")
  if (error) throw error
  const ids = (members ?? []).map((row) => row.user_id)
  if (!ids.length) return []
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, identity_pub_key")
    .in("id", ids)
  if (profileError) throw profileError
  const pubs = new Map((profiles ?? []).map((profile) => [profile.id, profile.identity_pub_key]))
  return ids.map((userId) => ({
    userId,
    identityPubKey: pubs.get(userId) ?? null,
  }))
}

async function fetchEpoch(conversationId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select("key_epoch")
    .eq("id", conversationId)
    .single()
  if (error || data == null) throw error ?? new Error("Conversation not found")
  return data.key_epoch
}

function requireMemberPubs(
  members: { userId: string; identityPubKey: string | null }[],
  excludeUserId?: string,
) {
  const targets = members.filter((member) => member.userId !== excludeUserId)
  const missing = targets.filter((member) => !member.identityPubKey)
  if (missing.length) {
    throw new Error("Waiting for everyone to set up encryption")
  }
  return targets.map((member) => ({
    userId: member.userId,
    pub: b64ToBytes(member.identityPubKey!),
  }))
}

async function shareCurrentKey(conversationId: string, epoch: number, key: Uint8Array) {
  const members = await fetchJoinedMembers(conversationId)
  const rows = members
    .filter((member) => member.identityPubKey)
    .map((member) => ({
      conversation_id: conversationId,
      user_id: member.userId,
      epoch,
      wrapped_key: wrapConversationKey(b64ToBytes(member.identityPubKey!), key),
    }))
  if (!rows.length) return
  const { error } = await supabase.from("conversation_keys").upsert(rows, {
    onConflict: "conversation_id,user_id,epoch",
  })
  if (error) throw error
}

async function withSharedKey(conversationId: string, epoch: number, key: Uint8Array) {
  try {
    await shareCurrentKey(conversationId, epoch, key)
  } catch {
    // Sharing is best-effort; the holder can still read their own messages.
  }
  return { epoch, key }
}

async function installEpoch(
  conversationId: string,
  epoch: number,
  targets: { userId: string; pub: Uint8Array }[],
) {
  const conversationKey = generateConversationKey()
  const wraps = targets.map((target) => ({
    user_id: target.userId,
    wrapped_key: wrapConversationKey(target.pub, conversationKey),
  }))
  const { error } = await supabase.rpc("install_conversation_epoch", {
    _conversation_id: conversationId,
    _epoch: epoch,
    _wraps: wraps,
  })
  if (error) throw error
  rememberKey(conversationId, epoch, conversationKey)
  return withSharedKey(conversationId, epoch, conversationKey)
}

export async function rotateConversationEpoch(
  conversationId: string,
  identitySecret: Uint8Array,
  options?: { excludeUserId?: string },
) {
  const members = await fetchJoinedMembers(conversationId)
  const remaining = members.filter((member) => member.userId !== options?.excludeUserId)
  if (!remaining.length) return null
  const targets = requireMemberPubs(members, options?.excludeUserId)
  const current = await fetchEpoch(conversationId)
  try {
    return await installEpoch(conversationId, current + 1, targets)
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (!/epoch conflict/i.test(message)) throw error
    return getConversationKey(conversationId, identitySecret)
  }
}

export async function ensureConversationKey(conversationId: string, identitySecret: Uint8Array) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error("Not signed in")
  return getConversationKey(conversationId, identitySecret, userId)
}

export async function getConversationKey(
  conversationId: string,
  identitySecret: Uint8Array,
  userId?: string,
) {
  const uid = userId ?? (await supabase.auth.getUser()).data.user?.id
  if (!uid) throw new Error("Not signed in")
  const epoch = await fetchEpoch(conversationId)
  if (epoch > 0) {
    const cached = keyCache.get(cacheKey(conversationId, epoch))
    if (cached) return withSharedKey(conversationId, epoch, cached)
    const wrapped = await fetchMyWrap(conversationId, uid, epoch)
    if (wrapped) {
      try {
        const key = await getCachedOrUnwrappedKey(conversationId, epoch, identitySecret, wrapped)
        if (key) return withSharedKey(conversationId, epoch, key)
      } catch {
        // Stale wrap for this identity; mint a fresh epoch below.
      }
    }
  }
  const members = await fetchJoinedMembers(conversationId)
  const targets = requireMemberPubs(members)
  const nextEpoch = Math.max(epoch, 0) + 1
  try {
    return await installEpoch(conversationId, nextEpoch, targets)
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (!/epoch conflict/i.test(message)) throw error
    const latest = await fetchEpoch(conversationId)
    const wrapped = await fetchMyWrap(conversationId, uid, latest)
    if (!wrapped) throw new Error("Could not install a chat key")
    const key = await getCachedOrUnwrappedKey(conversationId, latest, identitySecret, wrapped)
    if (!key) throw new Error("Could not open this chat key")
    return withSharedKey(conversationId, latest, key)
  }
}

export async function loadMyConversationKeys(userId: string, identitySecret: Uint8Array) {
  const { data, error } = await supabase
    .from("conversation_keys")
    .select("conversation_id, epoch, wrapped_key")
    .eq("user_id", userId)
  if (error) throw error
  const keys = new Map<string, Uint8Array>()
  for (const row of data ?? []) {
    try {
      const key = await getCachedOrUnwrappedKey(
        row.conversation_id,
        row.epoch,
        identitySecret,
        row.wrapped_key,
      )
      if (key) keys.set(cacheKey(row.conversation_id, row.epoch), key)
    } catch {
      // Skip wraps this identity cannot open (leftover rows).
    }
  }
  return keys
}

export function conversationKeyLookup(
  keys: Map<string, Uint8Array>,
  conversationId: string,
  epoch: number | null,
) {
  if (epoch == null) return null
  return keys.get(cacheKey(conversationId, epoch)) ?? null
}

export function encryptPayload(payload: Payload, key: Uint8Array) {
  return encryptText(key, serializePayload(payload))
}

export function decryptPayload(key: Uint8Array, nonce: string, body: string) {
  return parsePayload(decryptText(key, nonce, body))
}

export function packCiphertext(key: Uint8Array, plaintext: string) {
  const { nonce, body } = encryptText(key, plaintext)
  return `${nonce}.${body}`
}

export function unpackCiphertext(key: Uint8Array, packed: string) {
  const split = packed.indexOf(".")
  if (split < 0) return null
  try {
    return decryptText(key, packed.slice(0, split), packed.slice(split + 1))
  } catch {
    return null
  }
}

export function encryptMediaBytes(key: Uint8Array, bytes: Uint8Array) {
  const { nonce, ciphertext } = encryptBytes(key, bytes)
  return { mediaNonce: bytesToB64(nonce), ciphertext }
}

export function decryptMediaBytes(key: Uint8Array, mediaNonce: string, ciphertext: Uint8Array) {
  return decryptBytes(key, b64ToBytes(mediaNonce), ciphertext)
}

export { identityPublicKey, bytesToB64 }
