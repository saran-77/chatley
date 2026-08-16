import { useEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"

function ParticleField({ reduced }: { reduced: boolean | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (reduced) return
    const node = canvasRef.current
    const gfx = node?.getContext("2d") ?? null
    if (!node || !gfx) return
    const surface: HTMLCanvasElement = node
    const draw: CanvasRenderingContext2D = gfx

    let frame = 0
    let running = true
    const dots = Array.from({ length: 64 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00028,
      vy: (Math.random() - 0.5) * 0.00028,
      r: 0.7 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
    }))

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      surface.width = window.innerWidth * dpr
      surface.height = window.innerHeight * dpr
      surface.style.width = `${window.innerWidth}px`
      surface.style.height = `${window.innerHeight}px`
      draw.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function tick() {
      if (!running) return
      frame = window.requestAnimationFrame(tick)
      if (document.visibilityState !== "visible") return
      const width = window.innerWidth
      const height = window.innerHeight
      draw.clearRect(0, 0, width, height)
      const fill = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
      draw.fillStyle = fill || "oklch(0.42 0.09 150)"
      for (const dot of dots) {
        dot.x += dot.vx
        dot.y += dot.vy
        dot.phase += 0.018
        if (dot.x <= 0 || dot.x >= 1) dot.vx *= -1
        if (dot.y <= 0 || dot.y >= 1) dot.vy *= -1
        draw.globalAlpha = 0.16 + Math.abs(Math.sin(dot.phase)) * 0.28
        draw.beginPath()
        draw.arc(dot.x * width, dot.y * height, dot.r, 0, Math.PI * 2)
        draw.fill()
      }
      draw.globalAlpha = 1
    }

    resize()
    window.addEventListener("resize", resize)
    frame = window.requestAnimationFrame(tick)
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [reduced])

  if (reduced) return null
  return <canvas ref={canvasRef} className="absolute inset-0" />
}

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
      <ParticleField reduced={reduced} />
    </div>
  )
}
