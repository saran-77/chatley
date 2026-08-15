import { Outlet } from "react-router"

import { useIdentity } from "@/auth/identity-provider"
import { SetupKeysPage } from "@/pages/setup-keys-page"

export function IdentityGate() {
  const { mode } = useIdentity()
  if (mode === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading encryption…
      </div>
    )
  }
  if (mode !== "ready") return <SetupKeysPage />
  return <Outlet />
}
