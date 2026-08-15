import { motion, useReducedMotion } from "framer-motion"

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
        className="mesh-blob absolute top-[30%] -right-[15%] size-[48vw] min-h-[20rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,oklch(0.7_0.14_350),transparent_60%)_0%,transparent_70%)]"
        animate={reduced ? undefined : { x: [0, -30, 24, 0], y: [0, 36, -16, 0] }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="mesh-blob absolute -bottom-[25%] left-[20%] size-[44vw] min-h-[18rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,oklch(0.72_0.1_200),transparent_62%)_0%,transparent_72%)]"
        animate={reduced ? undefined : { x: [0, 18, -28, 0], y: [0, -22, 14, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
      />
    </div>
  )
}
