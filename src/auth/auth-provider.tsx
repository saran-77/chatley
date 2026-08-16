import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"

import { clearConversationKeyCache } from "@/lib/envelope"
import { clearIdentitySecret } from "@/lib/identity-store"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"

type AuthState = {
  session: Session | null
  user: User | null
  profile: Tables<"profiles"> | null
  loading: boolean
  signInWithGoogle: () => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  deleteAccount: () => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchProfile(userId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
    if (data) return data
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    supabase.auth.startAutoRefresh()
    const keepAlive = () => {
      if (document.visibilityState !== "visible") return
      supabase.auth.startAutoRefresh()
      void supabase.auth.getSession()
    }
    document.addEventListener("visibilitychange", keepAlive)
    window.addEventListener("focus", keepAlive)
    return () => {
      document.removeEventListener("visibilitychange", keepAlive)
      window.removeEventListener("focus", keepAlive)
    }
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      return
    }
    let cancelled = false
    void fetchProfile(userId).then((nextProfile) => {
      if (!cancelled) setProfile(nextProfile)
    })
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: { access_type: "offline" },
          },
        })
        return { error: error?.message }
      },
      signOut: async () => {
        const userId = session?.user.id
        if (userId) await clearIdentitySecret(userId)
        clearConversationKeyCache()
        await supabase.auth.signOut()
      },
      refreshProfile: async () => {
        if (!session?.user.id) return
        setProfile(await fetchProfile(session.user.id))
      },
      deleteAccount: async () => {
        const userId = session?.user.id
        const { error } = await supabase.functions.invoke("delete-account")
        if (error) return { error: error.message }
        if (userId) await clearIdentitySecret(userId)
        clearConversationKeyCache()
        try {
          await supabase.auth.signOut()
        } catch {
          // Auth user is already gone.
        }
        return {}
      },
    }),
    [session, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
