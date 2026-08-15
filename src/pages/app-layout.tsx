import { LogOut, MessageCircle, MoreHorizontal, Pin, PinOff, Plus, Settings } from "lucide-react"
import { LayoutGroup, AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router"
import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/auth/auth-provider"
import { ConversationAvatar } from "@/components/conversation-avatar"
import { EmptyLottie } from "@/components/empty-lottie"
import { InviteActions } from "@/components/invite-actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { UnreadBadge } from "@/components/unread-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  setConversationPinned,
  useConversations,
  type ConversationItem,
} from "@/hooks/use-conversations"
import { usePresence } from "@/hooks/use-presence"
import { easeOut } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"

function conversationTitle(conversation: ConversationItem, userId: string | undefined) {
  if (conversation.type === "group") return conversation.name ?? "Group"
  return (
    conversation.members.find((member) => member.id !== userId)?.display_name ??
    "Direct message"
  )
}

function isUnread(conversation: ConversationItem, userId: string | undefined) {
  if (!conversation.lastMessage || !userId) return false
  if (conversation.lastMessage.sender_id === userId) return false
  if (!conversation.lastReadAt) return true
  return conversation.lastMessage.sent_at > conversation.lastReadAt
}

export function AppLayout() {
  const { profile, user, signOut } = useAuth()
  const { data: conversations = [] } = useConversations()
  const queryClient = useQueryClient()
  const onlineIds = usePresence()
  const [query, setQuery] = useState("")
  const navigate = useNavigate()
  const location = useLocation()
  const onList = location.pathname === "/"
  const reduced = useReducedMotion()
  const didStagger = useRef(false)

  const filtered = conversations.filter((conversation) =>
    conversationTitle(conversation, user?.id).toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    if (filtered.length) didStagger.current = true
  }, [filtered.length])

  return (
    <div className="flex min-h-dvh bg-transparent">
      <aside
        className={cn(
          "glass-panel flex min-h-dvh w-full max-w-[320px] flex-col border-r shadow-[0_20px_50px_-28px_color-mix(in_oklch,var(--primary),transparent_62%)]",
          onList ? "max-md:max-w-none" : "max-md:hidden",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="flex items-center gap-2">
            <span className="accent-glow flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),oklch(0.48_0.08_145)_32%)] text-primary-foreground">
              <MessageCircle className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Chatley</p>
              <p className="text-[11px] text-muted-foreground">Your chats</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2 px-3 pb-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
          <Button
            size="icon"
            variant="outline"
            aria-label="New chat"
            onClick={() => navigate("/new")}
          >
            <Plus />
          </Button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              <EmptyLottie label="No conversations yet" />
              <p className="mt-2">No conversations yet. Start a chat.</p>
            </div>
          ) : (
            <LayoutGroup>
              {filtered.map((conversation, index) => {
                const other = conversation.members.find((member) => member.id !== user?.id)
                const title = conversationTitle(conversation, user?.id)
                const online = conversation.type === "dm" && other ? onlineIds.has(other.id) : false
                const unread = isUnread(conversation, user?.id)
                const delay = didStagger.current || reduced ? 0 : Math.min(index, 12) * 0.04
                return (
                  <motion.div
                    key={conversation.id}
                    layout={!reduced}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...(reduced ? { duration: 0.15 } : easeOut),
                      delay,
                      layout: reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 380, damping: 32 },
                    }}
                    whileHover={reduced ? undefined : { y: -1, scale: 1.015 }}
                    className="mb-1 rounded-xl hover:shadow-[0_10px_24px_-16px_color-mix(in_oklch,var(--primary),transparent_40%)]"
                  >
                    <div className="flex items-center">
                    <NavLink
                      to={`/c/${conversation.id}`}
                      className={({ isActive }) =>
                        cn(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-sm",
                          isActive &&
                            "accent-glow bg-gradient-to-br from-primary/18 to-[color-mix(in_oklch,oklch(0.7_0.08_145),transparent_88%)]",
                        )
                      }
                    >
                      <div className="relative">
                        <ConversationAvatar
                          title={title}
                          avatarPath={conversation.avatarPath}
                          fallbackUrl={
                            conversation.type === "dm" ? other?.avatar_url : null
                          }
                        />
                        {online ? (
                          <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate font-medium">
                          {conversation.pinnedAt ? (
                            <Pin className="size-3 shrink-0 text-muted-foreground" />
                          ) : null}
                          {title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {conversation.lastPreview}
                        </p>
                      </div>
                      <AnimatePresence>
                        {unread ? <UnreadBadge key="unread" /> : null}
                      </AnimatePresence>
                      {conversation.type === "group" ? (
                        <Badge variant="secondary">Group</Badge>
                      ) : conversation.myStatus === "pending" ? (
                        <Badge variant="secondary">Invite</Badge>
                      ) : null}
                    </NavLink>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="mr-1"
                          aria-label="Chat options"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => {
                            if (!user) return
                            void setConversationPinned(
                              conversation.id,
                              user.id,
                              !conversation.pinnedAt,
                            ).then(() =>
                              queryClient.invalidateQueries({
                                queryKey: ["conversations", user.id],
                              }),
                            )
                          }}
                        >
                          {conversation.pinnedAt ? <PinOff /> : <Pin />}
                          {conversation.pinnedAt ? "Unpin" : "Pin chat"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                    {conversation.myStatus === "pending" && user ? (
                      <div className="px-2 pb-2">
                        <InviteActions conversationId={conversation.id} userId={user.id} />
                      </div>
                    ) : null}
                  </motion.div>
                )
              })}
            </LayoutGroup>
          )}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link to="/settings" className="flex min-w-0 items-center gap-2">
            <ConversationAvatar
              size="sm"
              title={profile?.display_name ?? "You"}
              fallbackUrl={profile?.avatar_url}
            />
            <span className="truncate text-sm">{profile?.display_name ?? "You"}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" asChild aria-label="Settings">
              <Link to="/settings">
                <Settings />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              onClick={() => void signOut()}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>
      <main className={cn("min-w-0 flex-1", onList && "max-md:hidden")}>
        <Outlet />
      </main>
    </div>
  )
}
