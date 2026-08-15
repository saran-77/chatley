import { Smile } from "lucide-react"
import EmojiPicker, { Theme } from "emoji-picker-react"
import { useState } from "react"

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
  onPick,
  label,
}: {
  onPick: (emoji: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Smile />
      </Button>
      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(100vw-2rem,320px)]">
          <EmojiPickerPanel
            onPick={(emoji) => {
              onPick(emoji)
              setOpen(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
