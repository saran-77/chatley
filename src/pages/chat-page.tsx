import { ArrowLeft, ImageIcon, Paperclip, Pencil, Reply, Send, Trash2, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useMemo, useRef, useState } from "react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { Link, useNavigate, useParams } from "react-router"

import { useAuth } from "@/auth/auth-provider"
import { ActionSheet } from "@/components/action-sheet"
import { ChatMessageBubble, ReplyQuote } from "@/components/chat-message-bubble"
import { ConversationAvatar } from "@/components/conversation-avatar"
import { EmojiButton, EmojiPickerPanel } from "@/components/emoji-picker-panel"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { inviteUrl, isMessageReadByOthers, useConversations } from "@/hooks/use-conversations"
import { useMessages, type ChatMessage } from "@/hooks/use-messages"
import { usePresence, useTyping } from "@/hooks/use-presence"
import { useReactions } from "@/hooks/use-reactions"
import { springPop } from "@/lib/motion"
import { formatLastSeen } from "@/lib/time"

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
  const {
    data: messages = [],
    send,
    sendFile,
    sendImage,
    sendVoice,
    edit,
    remove,
    hide,
    isLoading,
  } = useMessages(conversationId, Boolean(canChat))
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
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null)
  const [confirmEveryone, setConfirmEveryone] = useState<ChatMessage | null>(null)
  const [reactionFor, setReactionFor] = useState<string | null>(null)
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<VirtuosoHandle>(null)

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
        : formatLastSeen(other?.last_seen_at)

  const typingLabel = useMemo(() => {
    const names = conversation?.members
      .filter((member) => typingIds.includes(member.id))
      .map((member) => member.display_name)
    if (!names?.length) return null
    return `${names.join(", ")} typing…`
  }, [conversation?.members, typingIds])

  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  )

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

  function memberName(senderId: string | null | undefined) {
    if (!senderId) return "Message"
    if (senderId === user?.id) return "You"
    return conversation?.members.find((member) => member.id === senderId)?.display_name ?? "Message"
  }

  function startReply(message: ChatMessage) {
    setEditing(null)
    setReplyTo(message)
    setActionsFor(null)
    textRef.current?.focus()
  }

  function startEdit(message: ChatMessage) {
    if (message.payload?.kind !== "text") return
    setReplyTo(null)
    setEditing(message)
    setDraft(message.payload.text)
    setActionsFor(null)
    textRef.current?.focus()
  }

  function cancelComposerMode() {
    if (editing) setDraft("")
    setReplyTo(null)
    setEditing(null)
  }

  function scrollToMessage(id: string) {
    const index = messages.findIndex((message) => message.id === id)
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, align: "center", behavior: "smooth" })
    }
  }

  const emojiSheetOpen = composerEmojiOpen || Boolean(reactionFor)
  const actionsMessage = actionsFor
  const actionsMine = actionsMessage?.sender_id === user?.id
  const actionsDeleted = Boolean(actionsMessage?.deleted_at)

  if (!conversationId) return null
  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Conversation not found.
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="glass-panel flex items-center gap-3 border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
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
            ref={listRef}
            className="h-full"
            data={messages}
            followOutput="smooth"
            increaseViewportBy={{ top: 120, bottom: 120 }}
            components={{
              Header: () => <div className="h-2" />,
              Footer: () => <div className="h-3" />,
            }}
            itemContent={(_index, message) => {
              const mine = message.sender_id === user?.id
              const sender = conversation.members.find((member) => member.id === message.sender_id)
              const quoted = message.reply_to_id
                ? messagesById.get(message.reply_to_id)
                : undefined
              const deleted = Boolean(message.deleted_at)
              return (
                <ChatMessageBubble
                  messageId={message.id}
                  mine={mine}
                  senderName={
                    conversation.type === "group" && !mine ? sender?.display_name : null
                  }
                  sentAt={message.sent_at}
                  edited={Boolean(message.edited_at)}
                  deleted={deleted}
                  read={isMessageReadByOthers(
                    message.sent_at,
                    conversation.members,
                    user?.id,
                  )}
                  onOpenActions={() => setActionsFor(message)}
                  footer={
                    deleted ? null : (
                      <MessageReactions
                        messageId={message.id}
                        reactions={reactions}
                        userId={userId}
                        onToggle={(id, emoji) => void toggleReaction(id, emoji)}
                        onAdd={() => setReactionFor(message.id)}
                      />
                    )
                  }
                >
                  {quoted ? (
                    <ReplyQuote
                      mine={mine}
                      senderName={memberName(quoted.sender_id)}
                      payload={quoted.payload}
                      error={quoted.error}
                      onClick={() => scrollToMessage(quoted.id)}
                    />
                  ) : message.reply_to_id ? (
                    <ReplyQuote
                      mine={mine}
                      senderName="Message"
                      payload={null}
                      error="Original message"
                    />
                  ) : null}
                  <MessageBody payload={message.payload} error={message.error} />
                </ChatMessageBubble>
              )
            }}
          />
        )}
      </div>

      <div className="glass-panel border-t px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
        {editing ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl border bg-background/40 px-2 py-1.5">
            <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              Editing message
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-11 md:size-7"
              aria-label="Cancel edit"
              onClick={() => {
                setEditing(null)
                setDraft("")
              }}
            >
              <X />
            </Button>
          </div>
        ) : replyTo ? (
          <div className="mb-2 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ReplyQuote
                senderName={memberName(replyTo.sender_id)}
                payload={replyTo.payload}
                error={replyTo.error}
                onClick={() => scrollToMessage(replyTo.id)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-1 size-11 md:size-7"
              aria-label="Cancel reply"
              onClick={() => setReplyTo(null)}
            >
              <X />
            </Button>
          </div>
        ) : null}
        <form
          className="flex flex-col gap-2 md:flex-row md:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            const text = draft.trim()
            if (!text) return
            setComposerError(null)
            if (editing) {
              void edit.mutateAsync({ messageId: editing.id, text }).catch((err) => {
                setComposerError(err instanceof Error ? err.message : "Could not edit message")
              })
              setEditing(null)
              setDraft("")
              return
            }
            setBurstId((current) => current + 1)
            void send
              .mutateAsync({
                payload: { kind: "text", text },
                replyToId: replyTo?.id,
              })
              .catch((err) => {
                setComposerError(err instanceof Error ? err.message : "Could not send")
              })
            setDraft("")
            setReplyTo(null)
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
              void sendFile
                .mutateAsync({ file, replyToId: replyTo?.id })
                .then(() => setReplyTo(null))
                .catch((err) => {
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
              void sendImage
                .mutateAsync({ file, replyToId: replyTo?.id })
                .then(() => setReplyTo(null))
                .catch((err) => {
                  setComposerError(err instanceof Error ? err.message : "Could not send image")
                })
            }}
          />
          {!editing ? (
            <div className="flex items-center gap-1 md:contents">
              <EmojiButton label="Insert emoji" onOpen={() => setComposerEmojiOpen(true)} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 md:size-8"
                aria-label="Send image"
                onClick={() => imageRef.current?.click()}
              >
                <ImageIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 md:size-8"
                aria-label="Attach file"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 md:contents">
              <EmojiButton label="Insert emoji" onOpen={() => setComposerEmojiOpen(true)} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 items-end gap-2">
          <textarea
            ref={textRef}
            value={draft}
            rows={1}
            aria-label={editing ? "Edit message" : "Message"}
            placeholder={editing ? "Edit your message" : "Write a message"}
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border bg-transparent px-3 py-2 text-base outline-none md:min-h-9 md:text-sm focus-visible:ring-3 focus-visible:ring-ring/50"
            onChange={(event) => {
              setDraft(event.target.value)
              if (!editing) broadcastTyping()
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                cancelComposerMode()
                return
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          {draft.trim() || editing ? (
            <motion.div
              className="relative shrink-0"
              whileTap={reduced ? undefined : { scale: 0.88 }}
              animate={reduced ? undefined : { scale: 1 }}
              transition={springPop}
            >
              <Button
                type="submit"
                size="icon"
                className="accent-glow size-11 md:size-8"
                aria-label={editing ? "Save edit" : "Send"}
                disabled={send.isPending || edit.isPending}
              >
                {editing ? <Pencil /> : <Send />}
              </Button>
              {!editing ? <SendBurst burstId={burstId} /> : null}
            </motion.div>
          ) : (
            <VoiceRecorderButton
              disabled={sendVoice.isPending}
              onError={setComposerError}
              onRecorded={async (file, durationMs) => {
                setComposerError(null)
                try {
                  await sendVoice.mutateAsync({
                    file,
                    durationMs,
                    replyToId: replyTo?.id,
                  })
                  setReplyTo(null)
                } catch (err) {
                  setComposerError(err instanceof Error ? err.message : "Could not send voice note")
                }
              }}
            />
          )}
          </div>
        </form>
          </>
        )}
      </div>
      <ActionSheet
        open={Boolean(actionsMessage)}
        onOpenChange={(open) => {
          if (!open) setActionsFor(null)
        }}
        title="Message"
      >
        <div className="grid gap-1">
          {!actionsDeleted ? (
            <Button
              variant="ghost"
              className="h-11 justify-start"
              onClick={() => {
                if (actionsMessage) startReply(actionsMessage)
              }}
            >
              <Reply />
              Reply
            </Button>
          ) : null}
          {actionsMine && !actionsDeleted && actionsMessage?.payload?.kind === "text" ? (
            <Button
              variant="ghost"
              className="h-11 justify-start"
              onClick={() => {
                if (actionsMessage) startEdit(actionsMessage)
              }}
            >
              <Pencil />
              Edit
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="h-11 justify-start text-destructive hover:text-destructive"
            onClick={() => {
              if (!actionsMessage) return
              const id = actionsMessage.id
              setActionsFor(null)
              void hide.mutateAsync(id).catch((err) => {
                setComposerError(err instanceof Error ? err.message : "Could not delete")
              })
            }}
          >
            <Trash2 />
            Delete for me
          </Button>
          {actionsMine && !actionsDeleted ? (
            <Button
              variant="ghost"
              className="h-11 justify-start text-destructive hover:text-destructive"
              onClick={() => {
                setConfirmEveryone(actionsMessage)
                setActionsFor(null)
              }}
            >
              <Trash2 />
              Delete for everyone
            </Button>
          ) : null}
        </div>
      </ActionSheet>
      <ActionSheet
        open={emojiSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setComposerEmojiOpen(false)
            setReactionFor(null)
          }
        }}
        title={reactionFor ? "React" : "Emoji"}
        className="p-2 sm:max-w-sm"
      >
        <EmojiPickerPanel
          className="border-0 shadow-none"
          onPick={(emoji) => {
            if (reactionFor) {
              void toggleReaction(reactionFor, emoji)
              setReactionFor(null)
              return
            }
            insertEmoji(emoji)
            setComposerEmojiOpen(false)
          }}
        />
      </ActionSheet>
      <Dialog
        open={Boolean(confirmEveryone)}
        onOpenChange={(open) => {
          if (!open) setConfirmEveryone(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete for everyone?</DialogTitle>
            <DialogDescription>
              This message will be removed for all people in this chat.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEveryone(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmEveryone) return
                const id = confirmEveryone.id
                setConfirmEveryone(null)
                void remove.mutateAsync(id).catch((err) => {
                  setComposerError(err instanceof Error ? err.message : "Could not delete")
                })
              }}
            >
              Delete for everyone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MotionToast message={copied ? "Invite link copied" : null} onClear={() => setCopied(false)} />
    </div>
  )
}
