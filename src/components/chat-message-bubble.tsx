import { motion, useReducedMotion } from "framer-motion"
import { useRef, type ReactNode } from "react"

import { ReadReceipt } from "@/components/read-receipt"
import { springSoft } from "@/lib/motion"
import { snippetText, type Payload } from "@/lib/payload"
import { formatMessageTime } from "@/lib/time"
import { cn } from "@/lib/utils"

const seenIds = new Set<string>()
const MOVE_PX = 10

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
  footer,
  children,
  onOpenActions,
}: {
  messageId: string
  mine: boolean
  senderName?: string | null
  sentAt: string
  edited?: boolean
  deleted?: boolean
  read?: boolean
  footer?: ReactNode
  children: ReactNode
  onOpenActions?: () => void
}) {
  const reduced = useReducedMotion()
  const shouldEnter = useRef(!seenIds.has(messageId))
  if (!seenIds.has(messageId)) seenIds.add(messageId)
  const pressTimer = useRef(0)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const offset = mine ? 18 : -18

  function clearPress() {
    window.clearTimeout(pressTimer.current)
    origin.current = null
  }

  return (
    <motion.div
      className={cn("flex px-3 py-1 sm:px-4", mine ? "justify-end" : "justify-start")}
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
      <div className={cn("flex max-w-[min(88%,28rem)] flex-col", mine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "touch-manipulation select-none rounded-2xl px-3 py-2 text-sm",
            mine
              ? "bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),oklch(0.48_0.08_145)_28%)] text-primary-foreground shadow-[0_10px_24px_-12px_color-mix(in_oklch,var(--primary),transparent_30%)]"
              : "glass-panel text-foreground shadow-[0_8px_20px_-14px_color-mix(in_oklch,var(--primary),transparent_55%)]",
            deleted && "opacity-80",
          )}
          onContextMenu={(event) => {
            if (!onOpenActions) return
            event.preventDefault()
            onOpenActions()
          }}
          onPointerDown={(event) => {
            if (!onOpenActions || event.button !== 0) return
            origin.current = { x: event.clientX, y: event.clientY }
            pressTimer.current = window.setTimeout(() => {
              origin.current = null
              onOpenActions()
            }, 450)
          }}
          onPointerMove={(event) => {
            if (!origin.current) return
            const dx = event.clientX - origin.current.x
            const dy = event.clientY - origin.current.y
            if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) clearPress()
          }}
          onPointerUp={clearPress}
          onPointerLeave={clearPress}
          onPointerCancel={clearPress}
        >
          {senderName ? <p className="mb-1 text-[11px] opacity-80">{senderName}</p> : null}
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
        {footer}
      </div>
    </motion.div>
  )
}
