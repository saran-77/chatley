import { motion, useReducedMotion } from "framer-motion"

export function TypingDots() {
  const reduced = useReducedMotion()
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="size-1.5 rounded-full bg-current"
          animate={
            reduced
              ? { opacity: 0.55 }
              : { opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.9, repeat: Infinity, delay: index * 0.14, ease: "easeInOut" }
          }
        />
      ))}
    </div>
  )
}
