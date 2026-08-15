import { motion, useReducedMotion } from "framer-motion"
import { useRef, type ReactNode } from "react"

import { ReadReceipt } from "@/components/read-receipt"
import { springSoft } from "@/lib/motion"
import { cn } from "@/lib/utils"

const seenIds = new Set<string>()

export function ChatMessageBubble({
  messageId,
  mine,
  senderName,
  children,
}: {
  messageId: string
  mine: boolean
  senderName?: string | null
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const shouldEnter = useRef(!seenIds.has(messageId))
  if (!seenIds.has(messageId)) seenIds.add(messageId)

  const offset = mine ? 18 : -18

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
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
          mine
            ? "bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),oklch(0.5_0.2_350)_28%)] text-primary-foreground shadow-[0_10px_24px_-12px_color-mix(in_oklch,var(--primary),transparent_30%)]"
            : "glass-panel text-foreground shadow-[0_8px_20px_-14px_color-mix(in_oklch,var(--primary),transparent_55%)]",
        )}
      >
        {senderName ? <p className="mb-1 text-[11px] opacity-80">{senderName}</p> : null}
        {children}
        {mine ? <ReadReceipt animateIn={shouldEnter.current} /> : null}
      </div>
    </motion.div>
  )
}
