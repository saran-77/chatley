import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/auth/auth-provider"
import { uploadChatFile, uploadChatImage, uploadChatVoice } from "@/lib/media"
import { parsePayload, serializePayload, type Payload } from "@/lib/payload"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"

export type ChatMessage = Tables<"messages"> & {
  payload: Payload | null
  error?: string
}

function readMessage(message: Tables<"messages">): Pick<ChatMessage, "payload" | "error"> {
  if (message.nonce) {
    return { payload: null, error: "This message is no longer available" }
  }
  const payload = parsePayload(message.body)
  return payload ? { payload } : { payload: null, error: "Could not read message" }
}

async function insertMessage(conversationId: string, userId: string, payload: Payload) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    body: serializePayload(payload),
  })
  if (error) throw error
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
}

export function useMessages(conversationId: string | undefined, enabled = true) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ["messages", conversationId, user?.id]

  const query = useQuery({
    queryKey,
    enabled: Boolean(conversationId && user?.id && enabled),
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("sent_at", { ascending: true })
      if (error) throw error
      return (data ?? []).map((message) => ({ ...message, ...readMessage(message) }))
    },
  })

  useEffect(() => {
    if (!conversationId || !user?.id || !enabled) return
    const channel = supabase
      .channel(`messages:${conversationId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, enabled, queryClient, queryKey, user?.id])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey })
    void queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] })
  }

  const send = useMutation({
    mutationFn: async (payload: Payload) => {
      if (!user?.id || !conversationId) throw new Error("No active conversation")
      await insertMessage(conversationId, user.id, payload)
    },
    onSuccess: invalidate,
  })

  const sendFile = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id || !conversationId) throw new Error("No active conversation")
      const payload = await uploadChatFile(conversationId, file)
      await insertMessage(conversationId, user.id, payload)
    },
    onSuccess: invalidate,
  })

  const sendImage = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id || !conversationId) throw new Error("No active conversation")
      const payload = await uploadChatImage(conversationId, file)
      await insertMessage(conversationId, user.id, payload)
    },
    onSuccess: invalidate,
  })

  const sendVoice = useMutation({
    mutationFn: async ({ file, durationMs }: { file: File; durationMs: number }) => {
      if (!user?.id || !conversationId) throw new Error("No active conversation")
      const payload = await uploadChatVoice(conversationId, file, durationMs)
      await insertMessage(conversationId, user.id, payload)
    },
    onSuccess: invalidate,
  })

  return { ...query, send, sendFile, sendImage, sendVoice }
}
