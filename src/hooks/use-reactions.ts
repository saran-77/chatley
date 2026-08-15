import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/auth/auth-provider"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"

export type Reaction = Tables<"message_reactions">

export function useReactions(conversationId: string | undefined, enabled: boolean) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ["reactions", conversationId]

  const query = useQuery({
    queryKey,
    enabled: Boolean(conversationId && user?.id && enabled),
    queryFn: async (): Promise<Reaction[]> => {
      const { data: messages, error: messageError } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId!)
      if (messageError) throw messageError
      const ids = (messages ?? []).map((message) => message.id)
      if (!ids.length) return []
      const { data, error } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", ids)
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    if (!conversationId || !user?.id || !enabled) return
    const channel = supabase
      .channel(`reactions:${conversationId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => {
          void queryClient.invalidateQueries({ queryKey })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, enabled, queryClient, queryKey, user?.id])

  async function toggleReaction(messageId: string, emoji: string) {
    if (!user?.id) return
    const existing = (query.data ?? []).find(
      (reaction) =>
        reaction.message_id === messageId &&
        reaction.user_id === user.id &&
        reaction.emoji === emoji,
    )
    if (existing) {
      const { error } = await supabase.from("message_reactions").delete().eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      })
      if (error) throw error
    }
    await queryClient.invalidateQueries({ queryKey })
  }

  return { reactions: query.data ?? [], toggleReaction, userId: user?.id }
}
