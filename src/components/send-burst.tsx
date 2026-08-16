import { motion, useReducedMotion } from "framer-motion"

export function SendBurst({ burstId }: { burstId: number }) {
  const reduced = useReducedMotion()
  if (reduced || burstId === 0) return null

  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2
        return (
          <motion.span
            key={`${burstId}-${index}`}
            className="absolute top-1/2 left-1/2 size-1.5 rounded-full bg-primary-foreground"
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos(angle) * 22,
              y: Math.sin(angle) * 22,
              scale: 0.2,
            }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          />
        )
      })}
    </span>
  )
}
