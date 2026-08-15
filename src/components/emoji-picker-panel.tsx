import { Smile } from "lucide-react"
import EmojiPicker, { Theme } from "emoji-picker-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function EmojiPickerPanel({
  onPick,
  className,
}: {
  onPick: (emoji: string) => void
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-popover shadow-md", className)}>
      <EmojiPicker
        theme={document.documentElement.classList.contains("dark") ? Theme.DARK : Theme.LIGHT}
        width="100%"
        height={320}
        lazyLoadEmojis
        previewConfig={{ showPreview: false }}
        onEmojiClick={(emoji) => onPick(emoji.emoji)}
      />
    </div>
  )
}

export function EmojiButton({
  onOpen,
  label,
}: {
  onOpen: () => void
  label: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 md:size-8"
      aria-label={label}
      onClick={onOpen}
    >
      <Smile />
    </Button>
  )
}
