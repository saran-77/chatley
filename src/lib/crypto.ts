import { gcm } from "@noble/ciphers/aes.js"
import { randomBytes } from "@noble/ciphers/utils.js"
import { x25519 } from "@noble/curves/ed25519.js"
import { hkdf } from "@noble/hashes/hkdf.js"
import { scryptAsync } from "@noble/hashes/scrypt.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { utf8ToBytes } from "@noble/hashes/utils.js"

const NONCE_LEN = 12
const KEY_LEN = 32
const PUB_LEN = 32
const BACKUP_PREFIX = "c1."
const WRAP_INFO = utf8ToBytes("chatley-wrap-v1")
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: KEY_LEN }

export class CryptoError extends Error {}

export function bytesToB64(bytes: Uint8Array) {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function b64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function concatBytes(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function generateIdentitySecret() {
  return x25519.utils.randomSecretKey()
}

export function identityPublicKey(secretKey: Uint8Array) {
  return x25519.getPublicKey(secretKey)
}

export function generateConversationKey() {
  return randomBytes(KEY_LEN)
}

export function encryptBytes(key: Uint8Array, plaintext: Uint8Array) {
  const nonce = randomBytes(NONCE_LEN)
  const ciphertext = gcm(key, nonce).encrypt(plaintext)
  return { nonce, ciphertext }
}

export function decryptBytes(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array) {
  try {
    return gcm(key, nonce).decrypt(ciphertext)
  } catch {
    throw new CryptoError("Could not decrypt")
  }
}

export function encryptText(key: Uint8Array, plaintext: string) {
  const { nonce, ciphertext } = encryptBytes(key, utf8ToBytes(plaintext))
  return { nonce: bytesToB64(nonce), body: bytesToB64(ciphertext) }
}

export function decryptText(key: Uint8Array, nonce: string, body: string) {
  const bytes = decryptBytes(key, b64ToBytes(nonce), b64ToBytes(body))
  return new TextDecoder().decode(bytes)
}

export function wrapConversationKey(recipientPubKey: Uint8Array, conversationKey: Uint8Array) {
  const ephemeralSecret = x25519.utils.randomSecretKey()
  const ephemeralPub = x25519.getPublicKey(ephemeralSecret)
  const shared = x25519.getSharedSecret(ephemeralSecret, recipientPubKey)
  const wrapKey = hkdf(sha256, shared, undefined, WRAP_INFO, KEY_LEN)
  const { nonce, ciphertext } = encryptBytes(wrapKey, conversationKey)
  return bytesToB64(concatBytes(ephemeralPub, nonce, ciphertext))
}

export function unwrapConversationKey(identitySecret: Uint8Array, wrappedKey: string) {
  const packed = b64ToBytes(wrappedKey)
  if (packed.length < PUB_LEN + NONCE_LEN + KEY_LEN) {
    throw new CryptoError("Invalid wrapped key")
  }
  const ephemeralPub = packed.subarray(0, PUB_LEN)
  const nonce = packed.subarray(PUB_LEN, PUB_LEN + NONCE_LEN)
  const ciphertext = packed.subarray(PUB_LEN + NONCE_LEN)
  const shared = x25519.getSharedSecret(identitySecret, ephemeralPub)
  const wrapKey = hkdf(sha256, shared, undefined, WRAP_INFO, KEY_LEN)
  const key = decryptBytes(wrapKey, nonce, ciphertext)
  if (key.length !== KEY_LEN) throw new CryptoError("Invalid conversation key")
  return key
}

export async function wrapIdentitySecret(passphrase: string, secretKey: Uint8Array) {
  if (passphrase.length < 8) throw new CryptoError("Passphrase must be at least 8 characters")
  const salt = randomBytes(16)
  const wrapKey = await scryptAsync(passphrase, salt, SCRYPT)
  const { nonce, ciphertext } = encryptBytes(wrapKey, secretKey)
  return {
    kdfSalt: bytesToB64(salt),
    wrappedIdentitySk: BACKUP_PREFIX + bytesToB64(concatBytes(nonce, ciphertext)),
  }
}

export function isBackupFormatSupported(wrappedIdentitySk: string) {
  return wrappedIdentitySk.startsWith(BACKUP_PREFIX)
}

export async function unwrapIdentitySecret(
  passphrase: string,
  kdfSalt: string,
  wrappedIdentitySk: string,
) {
  if (!isBackupFormatSupported(wrappedIdentitySk)) {
    throw new CryptoError("This backup is from an older version. Create new keys to continue.")
  }
  const wrapKey = await scryptAsync(passphrase, b64ToBytes(kdfSalt), SCRYPT)
  const packed = b64ToBytes(wrappedIdentitySk.slice(BACKUP_PREFIX.length))
  if (packed.length < NONCE_LEN + KEY_LEN) throw new CryptoError("Wrong passphrase")
  try {
    const secret = decryptBytes(wrapKey, packed.subarray(0, NONCE_LEN), packed.subarray(NONCE_LEN))
    if (secret.length !== KEY_LEN) throw new CryptoError("Wrong passphrase")
    return secret
  } catch (error) {
    if (error instanceof CryptoError) throw error
    throw new CryptoError("Wrong passphrase")
  }
}
