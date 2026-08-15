import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"

import { AuthProvider } from "@/auth/auth-provider"
import { IdentityProvider } from "@/auth/identity-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { queryClient } from "@/lib/query-client"
import App from "./App.tsx"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <IdentityProvider>
            <App />
          </IdentityProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
