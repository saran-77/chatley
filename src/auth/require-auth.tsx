import { Navigate, Outlet, useLocation } from "react-router"

import { useAuth } from "@/auth/auth-provider"

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!session) {
    sessionStorage.setItem("chatley-return-to", `${location.pathname}${location.search}`)
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
