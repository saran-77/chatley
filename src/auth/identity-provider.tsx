import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { useAuth } from "@/auth/auth-provider"
import {
  bytesToB64,
  CryptoError,
  generateIdentitySecret,
  identityPublicKey,
  isBackupFormatSupported,
  unwrapIdentitySecret,
  wrapIdentitySecret,
} from "@/lib/crypto"
import { clearConversationKeyCache } from "@/lib/envelope"
import {
  clearIdentitySecret,
  loadIdentitySecret,
  saveIdentitySecret,
} from "@/lib/identity-store"
import { supabase } from "@/lib/supabase"

type IdentityMode = "loading" | "create" | "unlock" | "ready"

type IdentityState = {
  mode: IdentityMode
  secretKey: Uint8Array | null
  publicKey: string | null
  backupCompatible: boolean
  createKeys: (passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  changePassphrase: (current: string, next: string) => Promise<void>
  resetKeys: (passphrase: string) => Promise<void>
}

const IdentityContext = createContext<IdentityState | null>(null)

async function fetchBackup(userId: string) {
  const { data, error } = await supabase
    .from("identity_backups")
    .select("kdf_salt, wrapped_identity_sk")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function publishIdentity(userId: string, secretKey: Uint8Array, passphrase: string) {
  const publicKey = bytesToB64(identityPublicKey(secretKey))
  const backup = await wrapIdentitySecret(passphrase, secretKey)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ identity_pub_key: publicKey })
    .eq("id", userId)
  if (profileError) throw profileError
  const { error: backupError } = await supabase.from("identity_backups").upsert({
    user_id: userId,
    kdf_salt: backup.kdfSalt,
    wrapped_identity_sk: backup.wrappedIdentitySk,
  })
  if (backupError) throw backupError
  await saveIdentitySecret(userId, secretKey)
  return publicKey
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { user, refreshProfile } = useAuth()
  const [mode, setMode] = useState<IdentityMode>("loading")
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [backupCompatible, setBackupCompatible] = useState(true)

  useEffect(() => {
    const userId = user?.id
    if (!userId) {
      clearConversationKeyCache()
      setSecretKey(null)
      setPublicKey(null)
      setMode("loading")
      return
    }
    let cancelled = false
    setMode("loading")
    void (async () => {
      try {
        const cached = await loadIdentitySecret(userId)
        if (cancelled) return
        if (cached) {
          const published = bytesToB64(identityPublicKey(cached))
          setSecretKey(cached)
          setPublicKey(published)
          setMode("ready")
          void supabase
            .from("profiles")
            .update({ identity_pub_key: published })
            .eq("id", userId)
          return
        }
        const backup = await fetchBackup(userId)
        if (cancelled) return
        if (!backup) {
          setBackupCompatible(true)
          setMode("create")
          return
        }
        setBackupCompatible(isBackupFormatSupported(backup.wrapped_identity_sk))
        setMode("unlock")
      } catch {
        if (!cancelled) setMode("create")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const value = useMemo<IdentityState>(
    () => ({
      mode,
      secretKey,
      publicKey,
      backupCompatible,
      createKeys: async (passphrase) => {
        if (!user?.id) throw new Error("Not signed in")
        const nextSecret = generateIdentitySecret()
        const published = await publishIdentity(user.id, nextSecret, passphrase)
        setSecretKey(nextSecret)
        setPublicKey(published)
        setMode("ready")
        await refreshProfile()
      },
      unlock: async (passphrase) => {
        if (!user?.id) throw new Error("Not signed in")
        const backup = await fetchBackup(user.id)
        if (!backup) throw new CryptoError("No backup found")
        const nextSecret = await unwrapIdentitySecret(
          passphrase,
          backup.kdf_salt,
          backup.wrapped_identity_sk,
        )
        await saveIdentitySecret(user.id, nextSecret)
        setSecretKey(nextSecret)
        setPublicKey(bytesToB64(identityPublicKey(nextSecret)))
        setMode("ready")
      },
      changePassphrase: async (current, next) => {
        if (!user?.id || !secretKey) throw new Error("Unlock encryption first")
        const backup = await fetchBackup(user.id)
        if (backup) {
          await unwrapIdentitySecret(current, backup.kdf_salt, backup.wrapped_identity_sk)
        }
        const wrapped = await wrapIdentitySecret(next, secretKey)
        const { error } = await supabase
          .from("identity_backups")
          .update({
            kdf_salt: wrapped.kdfSalt,
            wrapped_identity_sk: wrapped.wrappedIdentitySk,
          })
          .eq("user_id", user.id)
        if (error) throw error
      },
      resetKeys: async (passphrase) => {
        if (!user?.id) throw new Error("Not signed in")
        clearConversationKeyCache()
        await clearIdentitySecret(user.id)
        const nextSecret = generateIdentitySecret()
        const published = await publishIdentity(user.id, nextSecret, passphrase)
        setSecretKey(nextSecret)
        setPublicKey(published)
        setBackupCompatible(true)
        setMode("ready")
        await refreshProfile()
      },
    }),
    [backupCompatible, mode, publicKey, refreshProfile, secretKey, user?.id],
  )

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
}

export function useIdentity() {
  const context = useContext(IdentityContext)
  if (!context) throw new Error("useIdentity must be used within IdentityProvider")
  return context
}
