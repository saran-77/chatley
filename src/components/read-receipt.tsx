import { Check, CheckCheck } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import { springPop } from "@/lib/motion"
import { cn } from "@/lib/utils"

export function ReadReceipt({ read }: { read: boolean }) {
  const reduced = useReducedMotion()
  const label = read ? "Read" : "Sent"

  return (
    <span
      className={cn("inline-flex shrink-0", read ? "text-sky-200" : "text-primary-foreground/55")}
      aria-label={label}
      title={label}
    >
      <AnimatePresence mode="wait" initial={false}>
        {read ? (
          <motion.span
            key="read"
            className="inline-flex drop-shadow-[0_0_6px_rgba(125,211,252,0.85)]"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={reduced ? { duration: 0.12 } : springPop}
          >
            <CheckCheck className="size-4" />
          </motion.span>
        ) : (
          <motion.span
            key="sent"
            className="inline-flex"
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={reduced ? { duration: 0.12 } : { duration: 0.14 }}
          >
            <Check className="size-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
