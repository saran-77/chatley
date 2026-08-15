import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/auth/auth-provider"
import { uploadGroupAvatar } from "@/lib/media"
import { parsePayload, previewText } from "@/lib/payload"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"

export type MembershipStatus = "pending" | "joined"

export type ChatMember = Tables<"profiles"> & {
  membershipStatus: MembershipStatus
}

type LastMessage = Pick<
  Tables<"messages">,
  "id" | "conversation_id" | "body" | "nonce" | "sender_id" | "sent_at"
>

export type ConversationItem = {
  id: string
  type: "dm" | "group"
  name: string | null
  avatarPath: string | null
  inviteToken: string
  members: ChatMember[]
  lastMessage: LastMessage | null
  lastPreview: string
  lastReadAt: string | null
  pinnedAt: string | null
  myStatus: MembershipStatus
}

export function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`
}

function previewLastMessage(message: LastMessage | null) {
  if (!message) return "No messages yet"
  if (message.nonce) return "Unavailable message"
  return previewText(parsePayload(message.body))
}

export function useConversations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<ConversationItem[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, type, name, avatar_path, invite_token, created_at, conversation_members(user_id, last_read_at, pinned_at, status, profiles!conversation_members_user_id_fkey(*)), messages(id, conversation_id, body, nonce, sender_id, sent_at)",
        )
        .order("created_at", { ascending: false })
      if (error) throw error

      const items = (data ?? []).map((row) => {
        const members = (row.conversation_members ?? [])
          .map((member) => {
            const profile = member.profiles as Tables<"profiles"> | null
            if (!profile) return null
            return {
              ...profile,
              membershipStatus: (member.status === "pending" ? "pending" : "joined") as MembershipStatus,
            }
          })
          .filter(Boolean) as ChatMember[]
        const myMembership = (row.conversation_members ?? []).find(
          (member) => member.user_id === user?.id,
        )
        const myStatus: MembershipStatus =
          myMembership?.status === "pending" ? "pending" : "joined"
        const lastMessage =
          myStatus === "joined"
            ? (row.messages ?? [])
                .slice()
                .sort((a, b) => a.sent_at.localeCompare(b.sent_at))
                .at(-1) ?? null
            : null
        const other = members.find((member) => member.id !== user?.id)
        let lastPreview = previewLastMessage(lastMessage)
        if (myStatus === "pending") {
          lastPreview = "Invite — tap to accept"
        } else if (row.type === "dm" && other?.membershipStatus === "pending") {
          lastPreview = "Waiting for them to accept"
        }
        return {
          id: row.id,
          type: row.type as "dm" | "group",
          name: row.name,
          avatarPath: row.avatar_path,
          inviteToken: row.invite_token,
          members,
          lastMessage,
          lastPreview,
          lastReadAt: myMembership?.last_read_at ?? null,
          pinnedAt: myMembership?.pinned_at ?? null,
          myStatus,
        }
      })

      return items.sort((a, b) => {
        if (a.pinnedAt && !b.pinnedAt) return -1
        if (!a.pinnedAt && b.pinnedAt) return 1
        if (a.pinnedAt && b.pinnedAt) return b.pinnedAt.localeCompare(a.pinnedAt)
        if (a.myStatus === "pending" && b.myStatus !== "pending") return -1
        if (a.myStatus !== "pending" && b.myStatus === "pending") return 1
        const aTime = a.lastMessage?.sent_at ?? ""
        const bTime = b.lastMessage?.sent_at ?? ""
        return bTime.localeCompare(aTime)
      })
    },
  })

  useEffect(() => {
    if (!user?.id) return
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations", user.id] })
    }
    const channel = supabase
      .channel(`conversations-live:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        invalidate,
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, user?.id])

  return query
}

export async function createDirectMessage(localUserId: string, otherUserId: string) {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id, type, conversation_members(user_id)")
  const match = (existing ?? []).find((conversation) => {
    if (conversation.type !== "dm") return false
    const ids = new Set(conversation.conversation_members.map((member) => member.user_id))
    return ids.size === 2 && ids.has(localUserId) && ids.has(otherUserId)
  })
  if (match) return match.id

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({ type: "dm" })
    .select("id")
    .single()
  if (error || !conversation) throw error ?? new Error("Could not create chat")
  const { error: selfError } = await supabase.from("conversation_members").insert({
    conversation_id: conversation.id,
    user_id: localUserId,
    status: "joined",
  })
  if (selfError) throw selfError
  const { error: memberError } = await supabase.from("conversation_members").insert({
    conversation_id: conversation.id,
    user_id: otherUserId,
    status: "pending",
  })
  if (memberError) throw memberError
  return conversation.id
}

export async function createGroupChat(
  localUserId: string,
  name: string,
  memberIds: string[],
  photo?: File,
) {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({ type: "group", name })
    .select("id")
    .single()
  if (error || !conversation) throw error ?? new Error("Could not create group")
  const unique = Array.from(new Set(memberIds.filter((id) => id !== localUserId)))
  const { error: selfError } = await supabase.from("conversation_members").insert({
    conversation_id: conversation.id,
    user_id: localUserId,
    role: "admin",
    status: "joined",
  })
  if (selfError) throw selfError
  if (unique.length) {
    const { error: memberError } = await supabase.from("conversation_members").insert(
      unique.map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
        role: "member",
        status: "pending",
      })),
    )
    if (memberError) throw memberError
  }
  if (photo) {
    const avatarPath = await uploadGroupAvatar(conversation.id, photo)
    const { error: avatarError } = await supabase
      .from("conversations")
      .update({ avatar_path: avatarPath })
      .eq("id", conversation.id)
    if (avatarError) throw avatarError
  }
  return conversation.id
}

export async function setConversationPinned(
  conversationId: string,
  userId: string,
  pinned: boolean,
) {
  const { error } = await supabase
    .from("conversation_members")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
  if (error) throw error
}

export async function renameGroup(conversationId: string, name: string) {
  const { error } = await supabase
    .from("conversations")
    .update({ name })
    .eq("id", conversationId)
  if (error) throw error
}

export async function setGroupAvatar(conversationId: string, file: File) {
  const avatarPath = await uploadGroupAvatar(conversationId, file)
  const { error } = await supabase
    .from("conversations")
    .update({ avatar_path: avatarPath })
    .eq("id", conversationId)
  if (error) throw error
}

export async function addGroupMembers(conversationId: string, memberIds: string[]) {
  const unique = Array.from(new Set(memberIds))
  if (!unique.length) return
  const { error } = await supabase.from("conversation_members").insert(
    unique.map((userId) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: "member",
      status: "pending",
    })),
  )
  if (error) throw error
}

export async function acceptInvite(conversationId: string, userId: string) {
  const { error } = await supabase
    .from("conversation_members")
    .update({ status: "joined" })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
  if (error) throw error
}

export async function declineInvite(conversationId: string, userId: string) {
  const { error } = await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
  if (error) throw error
}

export async function leaveGroup(conversationId: string, userId: string) {
  const { error } = await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
  if (error) throw error
}

export async function joinByInviteToken(token: string) {
  const { data, error } = await supabase.rpc("join_by_invite_token", { _token: token })
  if (error || !data) throw error ?? new Error("Could not join")
  return data
}
