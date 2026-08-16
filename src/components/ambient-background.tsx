import { motion, useReducedMotion } from "framer-motion"

const SPARKS = [
  { left: "8%", top: "18%", size: 3, delay: "0s", duration: "11s" },
  { left: "22%", top: "72%", size: 2, delay: "1.2s", duration: "13s" },
  { left: "38%", top: "12%", size: 4, delay: "0.4s", duration: "9s" },
  { left: "54%", top: "58%", size: 2, delay: "2.1s", duration: "12s" },
  { left: "67%", top: "28%", size: 3, delay: "0.8s", duration: "10s" },
  { left: "79%", top: "76%", size: 2, delay: "1.6s", duration: "14s" },
  { left: "88%", top: "22%", size: 3, delay: "2.8s", duration: "11s" },
  { left: "14%", top: "44%", size: 2, delay: "0.2s", duration: "15s" },
  { left: "47%", top: "82%", size: 3, delay: "1.9s", duration: "12s" },
  { left: "71%", top: "8%", size: 2, delay: "3.1s", duration: "10s" },
  { left: "31%", top: "36%", size: 2, delay: "2.4s", duration: "13s" },
  { left: "92%", top: "48%", size: 3, delay: "0.6s", duration: "9s" },
]

export function AmbientBackground() {
  const reduced = useReducedMotion()
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-background" />
      <motion.div
        className="mesh-blob absolute -top-[20%] -left-[10%] size-[52vw] min-h-[22rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary),transparent_55%)_0%,transparent_68%)]"
        animate={reduced ? undefined : { x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="mesh-blob absolute top-[30%] -right-[15%] size-[48vw] min-h-[20rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,oklch(0.7_0.08_145),transparent_60%)_0%,transparent_70%)]"
        animate={reduced ? undefined : { x: [0, -30, 24, 0], y: [0, 36, -16, 0] }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="mesh-blob absolute -bottom-[25%] left-[20%] size-[44vw] min-h-[18rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,oklch(0.72_0.08_165),transparent_62%)_0%,transparent_72%)]"
        animate={reduced ? undefined : { x: [0, 18, -28, 0], y: [0, -22, 14, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
      />
      {reduced
        ? null
        : SPARKS.map((spark) => (
            <span
              key={`${spark.left}-${spark.top}`}
              className="particle-spark absolute rounded-full bg-primary"
              style={{
                left: spark.left,
                top: spark.top,
                width: spark.size,
                height: spark.size,
                animationDelay: spark.delay,
                animationDuration: spark.duration,
              }}
            />
          ))}
    </div>
  )
}
