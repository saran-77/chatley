import { useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { useAuth } from "@/auth/auth-provider"
import { decryptText, encryptText } from "@/lib/crypto"
import { supabase } from "@/lib/supabase"

const PRESENCE_TOPIC = "online-users"
const LAST_SEEN_MS = 45_000
const presenceListeners = new Set<(ids: Set<string>) => void>()
let presenceChannel: RealtimeChannel | null = null
let presenceJoin: Promise<void> | null = null

function currentOnlineIds() {
  if (!presenceChannel) return new Set<string>()
  return new Set(Object.keys(presenceChannel.presenceState()))
}

function emitPresence() {
  const ids = currentOnlineIds()
  presenceListeners.forEach((listener) => listener(ids))
}

async function touchLastSeen(userId: string) {
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId)
}

async function joinPresence(userId: string) {
  if (presenceChannel) return
  if (presenceJoin) {
    await presenceJoin
    return
  }
  presenceJoin = (async () => {
    const leftovers = supabase
      .getChannels()
      .filter((channel) => channel.topic === `realtime:${PRESENCE_TOPIC}`)
    await Promise.all(leftovers.map((channel) => supabase.removeChannel(channel)))
    const channel = supabase.channel(PRESENCE_TOPIC, {
      config: { presence: { key: userId } },
    })
    channel.on("presence", { event: "sync" }, emitPresence).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: userId, at: new Date().toISOString() })
        await touchLastSeen(userId)
      }
    })
    presenceChannel = channel
    if (presenceListeners.size === 0) {
      void supabase.removeChannel(channel)
      presenceChannel = null
    }
  })()
  try {
    await presenceJoin
  } finally {
    presenceJoin = null
  }
}

function leavePresence() {
  if (presenceListeners.size > 0 || !presenceChannel) return
  void supabase.removeChannel(presenceChannel)
  presenceChannel = null
}

export function usePresence() {
  const { user } = useAuth()
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user?.id) return
    const listener = (ids: Set<string>) => setOnlineIds(ids)
    presenceListeners.add(listener)
    void joinPresence(user.id).then(() => listener(currentOnlineIds()))

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void touchLastSeen(user.id)
    }, LAST_SEEN_MS)

    const onVisibility = () => {
      void touchLastSeen(user.id)
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onVisibility)

    return () => {
      presenceListeners.delete(listener)
      window.clearInterval(heartbeat)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onVisibility)
      void touchLastSeen(user.id)
      leavePresence()
    }
  }, [user?.id])

  return onlineIds
}

export function useTyping(conversationId: string | undefined, conversationKey: Uint8Array | null) {
  const { user } = useAuth()
  const [typingIds, setTypingIds] = useState<string[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const keyRef = useRef(conversationKey)
  keyRef.current = conversationKey

  useEffect(() => {
    if (!conversationId || !user?.id) return
    let cancelled = false
    let channel: RealtimeChannel | null = null
    const name = `typing:${conversationId}`

    void (async () => {
      const leftovers = supabase
        .getChannels()
        .filter((existing) => existing.topic === `realtime:${name}`)
      await Promise.all(leftovers.map((existing) => supabase.removeChannel(existing)))
      if (cancelled) return
      channel = supabase.channel(name)
      if (cancelled) {
        void supabase.removeChannel(channel)
        return
      }
      channelRef.current = channel
      channel
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const key = keyRef.current
          const nonce = payload?.nonce as string | undefined
          const body = payload?.body as string | undefined
          if (!key || !nonce || !body) return
          let from: string | undefined
          try {
            const parsed = JSON.parse(decryptText(key, nonce, body)) as { userId?: string }
            from = parsed.userId
          } catch {
            return
          }
          if (!from || from === user.id) return
          setTypingIds((current) => (current.includes(from!) ? current : [...current, from!]))
          window.setTimeout(() => {
            setTypingIds((current) => current.filter((id) => id !== from))
          }, 2000)
        })
        .subscribe()
    })()

    return () => {
      cancelled = true
      channelRef.current = null
      if (channel) void supabase.removeChannel(channel)
    }
  }, [conversationId, user?.id])

  function broadcastTyping() {
    const key = keyRef.current
    if (!user?.id || !key) return
    const encrypted = encryptText(key, JSON.stringify({ userId: user.id }))
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: encrypted,
    })
  }

  return { typingIds, broadcastTyping }
}
