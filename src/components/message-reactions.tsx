import { SmilePlus } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import type { Reaction } from "@/hooks/use-reactions"
import { cn } from "@/lib/utils"

export function MessageReactions({
  messageId,
  reactions,
  userId,
  onToggle,
  onAdd,
}: {
  messageId: string
  reactions: Reaction[]
  userId: string | undefined
  onToggle: (messageId: string, emoji: string) => void
  onAdd: () => void
}) {
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
    <div className="mt-1 flex max-w-[min(88vw,28rem)] flex-wrap items-center gap-1">
      {grouped.map(([emoji, info]) => (
        <button
          key={emoji}
          type="button"
          className={cn(
            "min-h-8 rounded-full border px-2 py-0.5 text-xs",
            info.mine ? "border-primary bg-primary/10" : "border-border bg-background/60",
          )}
          onClick={() => onToggle(messageId, emoji)}
        >
          {emoji} {info.count}
        </button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8"
        aria-label="Add reaction"
        onClick={onAdd}
      >
        <SmilePlus />
      </Button>
    </div>
  )
}
