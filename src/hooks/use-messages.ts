import { useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/auth/auth-provider"
import { useIdentity } from "@/auth/identity-provider"
import { CryptoError } from "@/lib/crypto"
import {
  decryptPayload,
  encryptPayload,
  ensureConversationKey,
  getCachedOrUnwrappedKey,
} from "@/lib/envelope"
import { uploadChatFile, uploadChatImage, uploadChatVoice } from "@/lib/media"
import { extractUrls, parsePayload, type Payload } from "@/lib/payload"
import { supabase } from "@/lib/supabase"
import { unfurlUrl } from "@/lib/unfurl"
import type { Tables } from "@/lib/database.types"

export type ChatMessage = Tables<"messages"> & {
  payload: Payload | null
  error?: string
  mediaKey?: Uint8Array
}

type ReadResult = Pick<ChatMessage, "payload" | "error" | "mediaKey"> & { skip?: boolean }

function readMessage(
  message: Tables<"messages">,
  key: Uint8Array | null,
): ReadResult {
  if (message.deleted_at) {
    return { payload: null, error: "This message was deleted" }
  }
  if (!message.nonce) {
    const payload = parsePayload(message.body)
    return payload ? { payload } : { payload: null, error: "Could not read message" }
  }
  if (message.key_epoch == null) {
    return { payload: null, error: "This message is no longer available" }
  }
  if (!key) return { payload: null, skip: true }
  try {
    const payload = decryptPayload(key, message.nonce, message.body)
    return payload
      ? { payload, mediaKey: key }
      : { payload: null, error: "Could not read message" }
  } catch (error) {
    if (error instanceof CryptoError) {
      return { payload: null, error: "This message is no longer available" }
    }
    return { payload: null, error: "Could not read message" }
  }
}

async function markConversationRead(conversationId: string, userId: string) {
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString(), hidden_at: null })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
}

async function withPreviews(payload: Payload): Promise<Payload> {
  if (payload.kind !== "text") return payload
  const urls = extractUrls(payload.text)
  if (!urls.length) return payload
  const previews = (await Promise.all(urls.map(unfurlUrl))).filter(
    (preview): preview is NonNullable<typeof preview> => Boolean(preview),
  )
  return previews.length ? { ...payload, previews } : payload
}

async function insertEncryptedMessage(
  conversationId: string,
  userId: string,
  identitySecret: Uint8Array,
  payload: Payload,
  replyToId?: string | null,
  envelope?: { epoch: number; key: Uint8Array },
) {
  const { epoch, key } = envelope ?? (await ensureConversationKey(conversationId, identitySecret))
  const ready = await withPreviews(payload)
  const encrypted = encryptPayload(ready, key)
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    body: encrypted.body,
    nonce: encrypted.nonce,
    key_epoch: epoch,
    reply_to_id: replyToId ?? null,
  })
  if (error) throw error
  await markConversationRead(conversationId, userId)
}

export function useMessages(conversationId: string | undefined, enabled = true) {
  const { user } = useAuth()
  const { secretKey } = useIdentity()
  const queryClient = useQueryClient()
  const queryKey = useMemo(
    () => ["messages", conversationId, user?.id] as const,
    [conversationId, user?.id],
  )

  const query = useQuery({
    queryKey,
    enabled: Boolean(conversationId && user?.id && secretKey && enabled),
    queryFn: async (): Promise<ChatMessage[]> => {
      const [{ data, error }, { data: hides, error: hideError }, { data: wraps, error: wrapError }] =
        await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId!)
            .order("sent_at", { ascending: true }),
          supabase.from("message_hides").select("message_id").eq("user_id", user!.id),
          supabase
            .from("conversation_keys")
            .select("epoch, wrapped_key")
            .eq("conversation_id", conversationId!)
            .eq("user_id", user!.id),
        ])
      if (error) throw error
      if (hideError) throw hideError
      if (wrapError) throw wrapError
      const hidden = new Set((hides ?? []).map((row) => row.message_id))
      const keys = new Map<number, Uint8Array>()
      for (const wrap of wraps ?? []) {
        try {
          const key = await getCachedOrUnwrappedKey(
            conversationId!,
            wrap.epoch,
            secretKey!,
            wrap.wrapped_key,
          )
          if (key) keys.set(wrap.epoch, key)
        } catch {
          // Leftover or mismatched wraps must not hide the rest of the thread.
        }
      }
      return (data ?? [])
        .filter((message) => !hidden.has(message.id))
        .map((message) => {
          const key = message.key_epoch == null ? null : (keys.get(message.key_epoch) ?? null)
          const read = readMessage(message, key)
          if (read.skip) return null
          const { skip: _skip, ...rest } = read
          return { ...message, ...rest }
        })
        .filter(Boolean) as ChatMessage[]
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_keys",
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
    if (!conversationId || !secretKey || !enabled) return
    void ensureConversationKey(conversationId, secretKey).catch(() => undefined)
  }, [conversationId, enabled, secretKey])

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
      if (!user?.id || !conversationId || !secretKey) throw new Error("No active conversation")
      await insertEncryptedMessage(conversationId, user.id, secretKey, payload, replyToId)
    },
    onSuccess: invalidate,
  })

  const sendFile = useMutation({
    mutationFn: async ({ file, replyToId }: { file: File; replyToId?: string | null }) => {
      if (!user?.id || !conversationId || !secretKey) throw new Error("No active conversation")
      const envelope = await ensureConversationKey(conversationId, secretKey)
      const payload = await uploadChatFile(conversationId, file, envelope.key)
      await insertEncryptedMessage(conversationId, user.id, secretKey, payload, replyToId, envelope)
    },
    onSuccess: invalidate,
  })

  const sendImage = useMutation({
    mutationFn: async ({ file, replyToId }: { file: File; replyToId?: string | null }) => {
      if (!user?.id || !conversationId || !secretKey) throw new Error("No active conversation")
      const envelope = await ensureConversationKey(conversationId, secretKey)
      const payload = await uploadChatImage(conversationId, file, envelope.key)
      await insertEncryptedMessage(conversationId, user.id, secretKey, payload, replyToId, envelope)
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
      if (!user?.id || !conversationId || !secretKey) throw new Error("No active conversation")
      const envelope = await ensureConversationKey(conversationId, secretKey)
      const payload = await uploadChatVoice(conversationId, file, durationMs, envelope.key)
      await insertEncryptedMessage(conversationId, user.id, secretKey, payload, replyToId, envelope)
    },
    onSuccess: invalidate,
  })

  const edit = useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      if (!user?.id || !conversationId || !secretKey) throw new Error("No active conversation")
      const { key } = await ensureConversationKey(conversationId, secretKey)
      const encrypted = encryptPayload({ kind: "text", text }, key)
      const { error } = await supabase
        .from("messages")
        .update({
          body: encrypted.body,
          nonce: encrypted.nonce,
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
      if (!user?.id || !conversationId || !secretKey) throw new Error("No active conversation")
      const { key } = await ensureConversationKey(conversationId, secretKey)
      const encrypted = encryptPayload({ kind: "text", text: "" }, key)
      const { error } = await supabase
        .from("messages")
        .update({
          body: encrypted.body,
          nonce: encrypted.nonce,
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
