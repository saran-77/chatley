import { MoreHorizontal, Pencil, Reply, Trash2 } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useRef, useState, type ReactNode } from "react"

import { ReadReceipt } from "@/components/read-receipt"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { springSoft } from "@/lib/motion"
import { snippetText, type Payload } from "@/lib/payload"
import { formatMessageTime } from "@/lib/time"
import { cn } from "@/lib/utils"

const seenIds = new Set<string>()

export function ReplyQuote({
  senderName,
  payload,
  error,
  mine,
  onClick,
}: {
  senderName: string
  payload: Payload | null
  error?: string
  mine?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mb-1 w-full rounded-lg border-l-2 px-2 py-1 text-left",
        mine
          ? "border-primary-foreground/70 bg-primary-foreground/10"
          : "border-primary/60 bg-background/50",
      )}
    >
      <p className="truncate text-[11px] font-medium">{senderName}</p>
      <p className="truncate text-[11px] opacity-80">
        {error || snippetText(payload, "Message")}
      </p>
    </button>
  )
}

export function ChatMessageBubble({
  messageId,
  mine,
  senderName,
  sentAt,
  edited,
  deleted,
  read,
  canEdit,
  children,
  onReply,
  onEdit,
  onDelete,
}: {
  messageId: string
  mine: boolean
  senderName?: string | null
  sentAt: string
  edited?: boolean
  deleted?: boolean
  read?: boolean
  canEdit?: boolean
  children: ReactNode
  onReply?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const reduced = useReducedMotion()
  const shouldEnter = useRef(!seenIds.has(messageId))
  if (!seenIds.has(messageId)) seenIds.add(messageId)
  const [menuOpen, setMenuOpen] = useState(false)
  const pressTimer = useRef<number>(0)
  const offset = mine ? 18 : -18
  const showActions = Boolean(!deleted && (onReply || (mine && (canEdit || onDelete))))

  function openMenu() {
    if (showActions) setMenuOpen(true)
  }

  return (
    <motion.div
      className={cn("flex px-4 py-1", mine ? "justify-end" : "justify-start")}
      initial={
        !shouldEnter.current
          ? false
          : reduced
            ? { opacity: 0 }
            : { opacity: 0, x: offset, y: 6, scale: 0.98 }
      }
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={reduced ? { duration: 0.16 } : springSoft}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <div
          className={cn(
            "group relative max-w-[min(75%,28rem)] rounded-2xl px-3 py-2 text-sm",
            mine
              ? "bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),oklch(0.48_0.08_145)_28%)] text-primary-foreground shadow-[0_10px_24px_-12px_color-mix(in_oklch,var(--primary),transparent_30%)]"
              : "glass-panel text-foreground shadow-[0_8px_20px_-14px_color-mix(in_oklch,var(--primary),transparent_55%)]",
            deleted && "opacity-80",
          )}
          onContextMenu={(event) => {
            if (!showActions) return
            event.preventDefault()
            openMenu()
          }}
          onPointerDown={() => {
            if (!showActions) return
            pressTimer.current = window.setTimeout(openMenu, 450)
          }}
          onPointerUp={() => window.clearTimeout(pressTimer.current)}
          onPointerLeave={() => window.clearTimeout(pressTimer.current)}
          onPointerCancel={() => window.clearTimeout(pressTimer.current)}
        >
          {showActions ? (
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="absolute top-1 right-1 rounded-md p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Message actions"
              >
                <MoreHorizontal className="size-3.5 opacity-80" />
              </button>
            </DropdownMenuTrigger>
          ) : null}
          {senderName ? <p className="mb-1 pr-5 text-[11px] opacity-80">{senderName}</p> : null}
          {children}
          <div
            className={cn(
              "mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80",
              mine ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {edited && !deleted ? <span>edited</span> : null}
            <span>{formatMessageTime(sentAt)}</span>
            {mine && !deleted ? <ReadReceipt read={Boolean(read)} /> : null}
          </div>
        </div>
        {showActions ? (
          <DropdownMenuContent align={mine ? "end" : "start"} className="w-40">
            {onReply ? (
              <DropdownMenuItem onClick={onReply}>
                <Reply />
                Reply
              </DropdownMenuItem>
            ) : null}
            {mine && canEdit && onEdit ? (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                Edit
              </DropdownMenuItem>
            ) : null}
            {mine && onDelete ? (
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        ) : null}
      </DropdownMenu>
    </motion.div>
  )
}
