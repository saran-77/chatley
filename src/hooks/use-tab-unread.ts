import { useEffect } from "react"

import { useAuth } from "@/auth/auth-provider"
import { unreadChatCount, useConversations } from "@/hooks/use-conversations"
import { applyTabUnread } from "@/lib/tab-indicator"

export function useTabUnread() {
  const { user } = useAuth()
  const { data: conversations = [] } = useConversations()
  const unreadChats = unreadChatCount(conversations, user?.id)

  useEffect(() => {
    applyTabUnread(unreadChats)
  }, [unreadChats])

  useEffect(() => {
    return () => {
      applyTabUnread(0)
    }
  }, [])
}
