import { Check, CheckCheck } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"

import { easeOut } from "@/lib/motion"

export function ReadReceipt({ animateIn = true }: { animateIn?: boolean }) {
  const reduced = useReducedMotion()
  const [double, setDouble] = useState(reduced || !animateIn)

  useEffect(() => {
    if (reduced || !animateIn) return
    const timer = window.setTimeout(() => setDouble(true), 180)
    return () => window.clearTimeout(timer)
  }, [reduced, animateIn])

  return (
    <span className="mt-1 flex justify-end" aria-label="Sent">
      <AnimatePresence mode="wait" initial={false}>
        {double ? (
          <motion.span
            key="double"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-primary-foreground"
            transition={reduced ? { duration: 0.12 } : { ...easeOut, duration: 0.18 }}
          >
            <CheckCheck className="size-3.5" />
          </motion.span>
        ) : (
          <motion.span
            key="single"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 0.75, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={reduced ? { duration: 0.12 } : { ...easeOut, duration: 0.16 }}
          >
            <Check className="size-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
