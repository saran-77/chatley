import { motion, useReducedMotion } from "framer-motion"

import { springPop } from "@/lib/motion"

export function UnreadBadge() {
  const reduced = useReducedMotion()
  return (
    <motion.span
      className="accent-glow inline-flex size-2.5 shrink-0 rounded-full bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),oklch(0.48_0.08_145)_40%)]"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
      transition={reduced ? { duration: 0.15 } : springPop}
      aria-label="Unread"
    />
  )
}
