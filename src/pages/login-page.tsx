import { MessageCircle } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useState } from "react"
import { Navigate, useLocation } from "react-router"

import { useAuth } from "@/auth/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { springPop, staggerFast } from "@/lib/motion"

export function LoginPage() {
  const { session, loading, signInWithGoogle } = useAuth()
  const location = useLocation()
  const reduced = useReducedMotion()
  const [error, setError] = useState<string | null>(
    (location.state as { error?: string } | null)?.error ?? null,
  )
  const [pending, setPending] = useState(false)

  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
  const next =
    sessionStorage.getItem("chatley-return-to") ||
    (from?.pathname ? `${from.pathname}${from.search ?? ""}` : "/")

  if (!loading && session) return <Navigate to={next} replace />

  const item = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 } }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute top-[18%] left-[12%] size-24 rounded-full bg-primary/25 blur-2xl"
        animate={reduced ? undefined : { y: [0, -18, 0], x: [0, 10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute right-[14%] bottom-[22%] size-32 rounded-3xl bg-[color-mix(in_oklch,oklch(0.7_0.08_145),transparent_55%)] blur-2xl"
        animate={reduced ? undefined : { y: [0, 16, 0], rotate: [8, 16, 8] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div variants={staggerFast} initial="initial" animate="animate">
        <motion.div variants={item} transition={reduced ? { duration: 0.16 } : springPop}>
          <Card className="glass-panel w-full max-w-sm bg-transparent shadow-[0_24px_80px_-28px_color-mix(in_oklch,var(--primary),transparent_50%)]">
            <CardHeader className="space-y-3 text-center">
              <motion.div
                variants={item}
                className="accent-glow mx-auto flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),oklch(0.48_0.08_145)_30%)] text-primary-foreground"
                transition={reduced ? { duration: 0.16 } : springPop}
              >
                <MessageCircle className="size-5" aria-hidden="true" />
              </motion.div>
              <motion.div variants={item}>
                <CardTitle className="text-xl">Welcome to Chatley</CardTitle>
                <CardDescription>Sign in to start chatting.</CardDescription>
              </motion.div>
            </CardHeader>
            <CardContent className="space-y-3">
              <motion.div
                variants={item}
                whileHover={reduced ? undefined : { scale: 1.03 }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
              >
                <Button
                  className={`w-full accent-glow ${pending ? "btn-shimmer" : ""}`}
                  size="lg"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true)
                    const result = await signInWithGoogle()
                    setPending(false)
                    if (result.error) setError(result.error)
                  }}
                >
                  {pending ? "Connecting…" : "Continue with Google"}
                </Button>
              </motion.div>
              {error ? (
                <p className="text-center text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <p className="text-center text-xs text-muted-foreground">
                Enable the Google provider in your Supabase project and add this
                origin to Auth redirect URLs.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
