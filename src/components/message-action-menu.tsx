import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { springPop } from "@/lib/motion"
import { cn } from "@/lib/utils"

const PAD = 8
const MENU_WIDTH = 204

function clampPosition(x: number, y: number, width: number, height: number) {
  const maxX = window.innerWidth - width - PAD
  const maxY = window.innerHeight - height - PAD
  return {
    left: Math.max(PAD, Math.min(x, maxX)),
    top: Math.max(PAD, Math.min(y, maxY)),
  }
}

export function MessageActionItem({
  children,
  destructive,
  onSelect,
}: {
  children: ReactNode
  destructive?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm outline-none md:h-9 [&_svg]:size-4 [&_svg]:shrink-0",
        destructive
          ? "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10"
          : "hover:bg-accent focus-visible:bg-accent",
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  )
}

export function MessageActionMenu({
  open,
  x,
  y,
  onClose,
  children,
}: {
  open: boolean
  x: number
  y: number
  onClose: () => void
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    if (!open) return
    const node = menuRef.current
    const width = node?.offsetWidth || MENU_WIDTH
    const height = node?.offsetHeight || 160
    setPos(clampPosition(x, y, width, height))
  }, [open, x, y])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <>
      {open ? (
        <button
          type="button"
          aria-label="Dismiss menu"
          className="fixed inset-0 z-50 cursor-default"
          onPointerDown={onClose}
        />
      ) : null}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="message-action-menu"
            ref={menuRef}
            role="menu"
            className="glass-panel fixed z-50 min-w-[12.75rem] rounded-xl p-1 shadow-[0_16px_40px_-18px_color-mix(in_oklch,var(--primary),transparent_45%)] ring-1 ring-foreground/10"
            style={{ left: pos.left, top: pos.top, transformOrigin: "top left" }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 4 }}
            transition={reduced ? { duration: 0.12 } : springPop}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>,
    document.body,
  )
}
