import { useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { useAuth } from "@/auth/auth-provider"
import { supabase } from "@/lib/supabase"

const PRESENCE_TOPIC = "online-users"
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
    return () => {
      presenceListeners.delete(listener)
      leavePresence()
    }
  }, [user?.id])

  return onlineIds
}

export function useTyping(conversationId: string | undefined) {
  const { user } = useAuth()
  const [typingIds, setTypingIds] = useState<string[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

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
          const from = payload?.userId as string | undefined
          if (!from || from === user.id) return
          setTypingIds((current) =>
            current.includes(from) ? current : [...current, from],
          )
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
    if (!user?.id) return
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id },
    })
  }

  return { typingIds, broadcastTyping }
}
