import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useEffect } from "react"

export function MotionToast({
  message,
  onClear,
}: {
  message: string | null
  onClear?: () => void
}) {
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!message || !onClear) return
    const timer = window.setTimeout(onClear, 2400)
    return () => window.clearTimeout(timer)
  }, [message, onClear])

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          className="glass-toast pointer-events-none fixed right-4 bottom-4 z-50 max-w-sm rounded-2xl px-4 py-3 text-sm shadow-[0_12px_40px_-12px_color-mix(in_oklch,var(--primary),transparent_45%)]"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
          transition={
            reduced
              ? { duration: 0.16 }
              : { type: "spring", stiffness: 380, damping: 28 }
          }
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
