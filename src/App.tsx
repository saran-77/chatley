import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { MotionConfig } from "framer-motion"

import { IdentityGate } from "@/auth/identity-gate"
import { RequireAuth } from "@/auth/require-auth"
import { AmbientBackground } from "@/components/ambient-background"
import { AppLayout } from "@/pages/app-layout"
import { AuthCallbackPage } from "@/pages/auth-callback-page"
import { ChatPage } from "@/pages/chat-page"
import { EmptyChatPage } from "@/pages/empty-chat-page"
import { InvitePage } from "@/pages/invite-page"
import { LoginPage } from "@/pages/login-page"
import { NewChatPage } from "@/pages/new-chat-page"
import { SettingsPage } from "@/pages/settings-page"

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AmbientBackground />
      <div className="relative z-10">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<IdentityGate />}>
              <Route path="invite/:token" element={<InvitePage />} />
              <Route element={<AppLayout />}>
                <Route index element={<EmptyChatPage />} />
                <Route path="c/:conversationId" element={<ChatPage />} />
                <Route path="new" element={<NewChatPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </MotionConfig>
  )
}
