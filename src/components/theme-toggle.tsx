import { Moon, Sun } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import { Switch } from "@/components/ui/switch"
import { useThemeStore } from "@/stores/theme"

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const reduced = useReducedMotion()
  const isDark = theme === "dark"

  function switchTheme() {
    const next = () => toggleTheme()
    if (reduced || !("startViewTransition" in document)) {
      next()
      return
    }
    document.startViewTransition(next)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="relative size-4">
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.span
              key="moon"
              className="absolute inset-0"
              initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -40, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 40, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              <Moon className="size-4 text-muted-foreground" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              className="absolute inset-0"
              initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: 40, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: -40, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              <Sun className="size-4 text-muted-foreground" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <Switch
        checked={isDark}
        onCheckedChange={() => switchTheme()}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      />
    </div>
  )
}
