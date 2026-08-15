import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "light" | "dark"

type ThemeState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => {
        applyThemeClass(theme)
        set({ theme })
      },
      toggleTheme: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark"
        get().setTheme(next)
      },
    }),
    {
      name: "chatley-theme",
      onRehydrateStorage: () => (state) => {
        applyThemeClass(state?.theme ?? "light")
      },
    },
  ),
)
