import { type Transition } from "framer-motion"

export const springPop: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 24,
  mass: 0.7,
}

export const springSoft: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 24,
}

export const easeOut: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
}

export function fadeSlide(reduced: boolean | null, x = 0, y = 8) {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.15 },
    }
  }
  return {
    initial: { opacity: 0, x, y, scale: 0.98 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, y: 6, scale: 0.98 },
    transition: easeOut,
  }
}

export const staggerFast = {
  animate: {
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
}
