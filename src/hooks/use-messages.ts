import { useEffect, useMemo } from "react"
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

const DELETED_BODY = JSON.stringify({ kind: "text", text: "" })

function readMessage(message: Tables<"messages">): Pick<ChatMessage, "payload" | "error"> {
  if (message.deleted_at) {
    return { payload: null, error: "This message was deleted" }
  }
  if (message.nonce) {
    return { payload: null, error: "This message is no longer available" }
  }
  const payload = parsePayload(message.body)
  return payload ? { payload } : { payload: null, error: "Could not read message" }
}

export function toChatMessage(message: Tables<"messages">): ChatMessage {
  return { ...message, ...readMessage(message) }
}

async function markConversationRead(conversationId: string, userId: string) {
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString(), hidden_at: null })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
}

async function insertMessage(
  conversationId: string,
  userId: string,
  payload: Payload,
  replyToId?: string | null,
) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    body: serializePayload(payload),
    reply_to_id: replyToId ?? null,
  })
  if (error) throw error
  await markConversationRead(conversationId, userId)
}

export function useMessages(conversationId: string | undefined, enabled = true) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = useMemo(
    () => ["messages", conversationId, user?.id] as const,
    [conversationId, user?.id],
  )

  const query = useQuery({
    queryKey,
    enabled: Boolean(conversationId && user?.id && enabled),
    queryFn: async (): Promise<ChatMessage[]> => {
      const [{ data, error }, { data: hides, error: hideError }] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId!)
          .order("sent_at", { ascending: true }),
        supabase
          .from("message_hides")
          .select("message_id")
          .eq("user_id", user!.id),
      ])
      if (error) throw error
      if (hideError) throw hideError
      const hidden = new Set((hides ?? []).map((row) => row.message_id))
      return (data ?? [])
        .filter((message) => !hidden.has(message.id))
        .map(toChatMessage)
    },
  })

  useEffect(() => {
    if (!conversationId || !user?.id || !enabled) return
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey })
    }
    const channel = supabase
      .channel(`messages:${conversationId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_hides",
          filter: `user_id=eq.${user.id}`,
        },
        invalidate,
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, enabled, queryClient, queryKey, user?.id])

  useEffect(() => {
    if (!conversationId || !user?.id || !enabled || !query.data?.length) return
    void markConversationRead(conversationId, user.id).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["conversations", user.id] })
    })
  }, [conversationId, enabled, query.data?.length, query.dataUpdatedAt, queryClient, user?.id])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey })
    void queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] })
  }

  const send = useMutation({
    mutationFn: async ({
      payload,
      replyToId,
    }: {
      payload: Payload
      replyToId?: string | null
    }) => {
      if (!user?.id || !conversationId) throw new Error("No active conversation")
      await insertMessage(conversationId, user.id, payload, replyToId)
    },
    onSuccess: invalidate,
  })

  const sendFile = useMutation({
    mutationFn: async ({ file, replyToId }: { file: File; replyToId?: string | null }) => {
      if (!user?.id || !conversationId) throw new Error("No active conversation")
      const payload = await uploadChatFile(conversationId, file)
      await insertMessage(conversationId, user.id, payload, replyToId)
    },
    onSuccess: invalidate,
  })

  const sendImage = useMutation({
    mutationFn: async ({ file, replyToId }: { file: File; replyToId?: string | null }) => {
      if (!user?.id || !conversationId) throw new Error("No active conversation")
      const payload = await uploadChatImage(conversationId, file)
      await insertMessage(conversationId, user.id, payload, replyToId)
    },
    onSuccess: invalidate,
  })

  const sendVoice = useMutation({
    mutationFn: async ({
      file,
      durationMs,
      replyToId,
    }: {
      file: File
      durationMs: number
      replyToId?: string | null
    }) => {
      if (!user?.id || !conversationId) throw new Error("No active conversation")
      const payload = await uploadChatVoice(conversationId, file, durationMs)
      await insertMessage(conversationId, user.id, payload, replyToId)
    },
    onSuccess: invalidate,
  })

  const edit = useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      if (!user?.id) throw new Error("No active conversation")
      const { error } = await supabase
        .from("messages")
        .update({
          body: serializePayload({ kind: "text", text }),
          edited_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .eq("sender_id", user.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user?.id) throw new Error("No active conversation")
      const { error } = await supabase
        .from("messages")
        .update({
          body: DELETED_BODY,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .eq("sender_id", user.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const hide = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user?.id) throw new Error("No active conversation")
      const { error } = await supabase.from("message_hides").insert({
        message_id: messageId,
        user_id: user.id,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...query, send, sendFile, sendImage, sendVoice, edit, remove, hide }
}
