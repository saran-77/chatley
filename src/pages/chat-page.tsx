import { ArrowLeft, ImageIcon, Paperclip, Send } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useMemo, useRef, useState } from "react"
import { Virtuoso } from "react-virtuoso"
import { Link, useNavigate, useParams } from "react-router"

import { useAuth } from "@/auth/auth-provider"
import { ChatMessageBubble } from "@/components/chat-message-bubble"
import { ConversationAvatar } from "@/components/conversation-avatar"
import { EmojiButton } from "@/components/emoji-picker-panel"
import { EmptyLottie } from "@/components/empty-lottie"
import { GroupInfoDialog } from "@/components/group-info-dialog"
import { InviteActions } from "@/components/invite-actions"
import { MessageBody } from "@/components/message-body"
import { MessageReactions } from "@/components/message-reactions"
import { MotionToast } from "@/components/motion-toast"
import { SendBurst } from "@/components/send-burst"
import { TypingDots } from "@/components/typing-dots"
import { VoiceRecorderButton } from "@/components/voice-recorder-button"
import { Button } from "@/components/ui/button"
import { inviteUrl, useConversations } from "@/hooks/use-conversations"
import { useMessages } from "@/hooks/use-messages"
import { usePresence, useTyping } from "@/hooks/use-presence"
import { useReactions } from "@/hooks/use-reactions"
import { springPop } from "@/lib/motion"

export function ChatPage() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const { data: conversations = [] } = useConversations()
  const conversation = conversations.find((item) => item.id === conversationId)
  const canChat =
    conversation?.myStatus === "joined" &&
    (conversation.type === "group" ||
      conversation.members
        .filter((member) => member.id !== user?.id)
        .every((member) => member.membershipStatus === "joined"))
  const { data: messages = [], send, sendFile, sendImage, sendVoice, isLoading } =
    useMessages(conversationId, Boolean(canChat))
  const { reactions, toggleReaction, userId } = useReactions(
    conversationId,
    Boolean(canChat),
  )
  const onlineIds = usePresence()
  const { typingIds, broadcastTyping } = useTyping(conversationId)
  const [draft, setDraft] = useState("")
  const [composerError, setComposerError] = useState<string | null>(null)
  const [groupOpen, setGroupOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [burstId, setBurstId] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const other = conversation?.members.find((member) => member.id !== user?.id)
  const joinedCount =
    conversation?.members.filter((member) => member.membershipStatus === "joined").length ?? 0
  const title =
    conversation?.type === "group"
      ? conversation.name ?? "Group"
      : other?.display_name ?? "Chat"
  const subtitle =
    conversation?.type === "group"
      ? `${joinedCount} members`
      : other && onlineIds.has(other.id)
        ? "Online"
        : "Chat"

  const typingLabel = useMemo(() => {
    const names = conversation?.members
      .filter((member) => typingIds.includes(member.id))
      .map((member) => member.display_name)
    if (!names?.length) return null
    return `${names.join(", ")} typing…`
  }, [conversation?.members, typingIds])

  function insertEmoji(emoji: string) {
    const field = textRef.current
    if (!field) {
      setDraft((current) => current + emoji)
      return
    }
    const start = field.selectionStart
    const end = field.selectionEnd
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)
    window.requestAnimationFrame(() => {
      field.focus()
      const cursor = start + emoji.length
      field.setSelectionRange(cursor, cursor)
    })
  }

  if (!conversationId) return null
  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Conversation not found.
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="glass-panel flex items-center gap-3 border-b px-3 py-2">
        <Button variant="ghost" size="icon-sm" className="md:hidden" asChild>
          <Link to="/" aria-label="Back to chats">
            <ArrowLeft />
          </Link>
        </Button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => {
            if (conversation.type === "group") setGroupOpen(true)
          }}
        >
          <ConversationAvatar
            title={title}
            avatarPath={conversation.avatarPath}
            fallbackUrl={conversation.type === "dm" ? other?.avatar_url : null}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </button>
      </header>
      {conversation.type === "group" ? (
        <GroupInfoDialog
          conversation={conversation}
          open={groupOpen}
          onOpenChange={setGroupOpen}
        />
      ) : null}

      <div className="min-h-0 flex-1">
        {conversation.myStatus !== "joined" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Accept this invite to start chatting.
            </p>
            {user ? (
              <InviteActions
                conversationId={conversation.id}
                userId={user.id}
                onDeclined={() => navigate("/")}
              />
            ) : null}
          </div>
        ) : isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <EmptyLottie label="No messages yet" />
            <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
          </div>
        ) : (
          <Virtuoso
            className="h-full"
            data={messages}
            followOutput="smooth"
            itemContent={(_index, message) => {
              const mine = message.sender_id === user?.id
              const sender = conversation.members.find((member) => member.id === message.sender_id)
              return (
                <ChatMessageBubble
                  messageId={message.id}
                  mine={mine}
                  senderName={
                    conversation.type === "group" && !mine ? sender?.display_name : null
                  }
                >
                  <MessageBody
                    payload={message.payload}
                    error={message.error}
                  />
                  <MessageReactions
                    messageId={message.id}
                    reactions={reactions}
                    userId={userId}
                    onToggle={(id, emoji) => void toggleReaction(id, emoji)}
                  />
                </ChatMessageBubble>
              )
            }}
          />
        )}
      </div>

      <div className="glass-panel border-t px-3 py-2">
        {!canChat ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              {conversation.myStatus === "pending"
                ? "Accept the invite to send messages."
                : "Waiting for them to accept before the first chat."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl(conversation.inviteToken))
                setCopied(true)
              }}
            >
              {copied ? "Link copied" : "Copy invite link"}
            </Button>
          </div>
        ) : (
          <>
        <AnimatePresence>
          {typingLabel ? (
            <motion.p
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
              className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <TypingDots />
              {typingLabel}
            </motion.p>
          ) : null}
        </AnimatePresence>
        {composerError ? (
          <p className="mb-1 text-xs text-destructive">{composerError}</p>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const text = draft.trim()
            if (!text) return
            setBurstId((current) => current + 1)
            void send.mutateAsync({ kind: "text", text })
            setDraft("")
          }}
        >
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              setComposerError(null)
              void sendFile.mutateAsync(file).catch((err) => {
                setComposerError(err instanceof Error ? err.message : "Could not send file")
              })
            }}
          />
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              setComposerError(null)
              void sendImage.mutateAsync(file).catch((err) => {
                setComposerError(err instanceof Error ? err.message : "Could not send image")
              })
            }}
          />
          <EmojiButton label="Insert emoji" onPick={insertEmoji} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Send image"
            onClick={() => imageRef.current?.click()}
          >
            <ImageIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach file"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
          </Button>
          <textarea
            ref={textRef}
            value={draft}
            rows={1}
            aria-label="Message"
            placeholder="Write a message"
            className="max-h-32 min-h-9 flex-1 resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onChange={(event) => {
              setDraft(event.target.value)
              broadcastTyping()
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          {draft.trim() ? (
            <motion.div
              className="relative"
              whileTap={reduced ? undefined : { scale: 0.88 }}
              animate={reduced ? undefined : { scale: 1 }}
              transition={springPop}
            >
              <Button
                type="submit"
                size="icon"
                className="accent-glow"
                aria-label="Send"
                disabled={send.isPending}
              >
                <Send />
              </Button>
              <SendBurst burstId={burstId} />
            </motion.div>
          ) : (
            <VoiceRecorderButton
              disabled={sendVoice.isPending}
              onError={setComposerError}
              onRecorded={async (file, durationMs) => {
                setComposerError(null)
                try {
                  await sendVoice.mutateAsync({ file, durationMs })
                } catch (err) {
                  setComposerError(err instanceof Error ? err.message : "Could not send voice note")
                }
              }}
            />
          )}
        </form>
          </>
        )}
      </div>
      <MotionToast message={copied ? "Invite link copied" : null} onClear={() => setCopied(false)} />
    </div>
  )
}
