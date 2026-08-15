import { useEffect } from "react"
import { useNavigate } from "react-router"

import { supabase } from "@/lib/supabase"

function nextPath() {
  const next = sessionStorage.getItem("chatley-return-to") || "/"
  sessionStorage.removeItem("chatley-return-to")
  return next
}

export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    const run = async () => {
      const url = new URL(window.location.href)
      if (url.searchParams.get("code")) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (!active) return
        if (error) {
          const { data } = await supabase.auth.getSession()
          if (data.session) {
            navigate(nextPath(), { replace: true })
            return
          }
          navigate("/login", { replace: true, state: { error: error.message } })
          return
        }
      }
      if (!active) return
      navigate(nextPath(), { replace: true })
    }
    void run()
    return () => {
      active = false
    }
  }, [navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      Finishing sign-in…
    </div>
  )
}
