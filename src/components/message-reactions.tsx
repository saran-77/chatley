import { SmilePlus } from "lucide-react"
import { useMemo, useState } from "react"

import { EmojiPickerPanel } from "@/components/emoji-picker-panel"
import { Button } from "@/components/ui/button"
import type { Reaction } from "@/hooks/use-reactions"
import { cn } from "@/lib/utils"

export function MessageReactions({
  messageId,
  reactions,
  userId,
  onToggle,
}: {
  messageId: string
  reactions: Reaction[]
  userId: string | undefined
  onToggle: (messageId: string, emoji: string) => void
}) {
  const [open, setOpen] = useState(false)
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>()
    for (const reaction of reactions) {
      if (reaction.message_id !== messageId) continue
      const current = map.get(reaction.emoji) ?? { count: 0, mine: false }
      current.count += 1
      if (reaction.user_id === userId) current.mine = true
      map.set(reaction.emoji, current)
    }
    return [...map.entries()]
  }, [messageId, reactions, userId])

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {grouped.map(([emoji, info]) => (
        <button
          key={emoji}
          type="button"
          className={cn(
            "rounded-full border px-1.5 py-0.5 text-xs",
            info.mine ? "border-primary bg-primary/10" : "border-border bg-background/60",
          )}
          onClick={() => onToggle(messageId, emoji)}
        >
          {emoji} {info.count}
        </button>
      ))}
      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Add reaction"
          onClick={() => setOpen((current) => !current)}
        >
          <SmilePlus />
        </Button>
        {open ? (
          <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(100vw-2rem,320px)]">
            <EmojiPickerPanel
              onPick={(emoji) => {
                onToggle(messageId, emoji)
                setOpen(false)
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
