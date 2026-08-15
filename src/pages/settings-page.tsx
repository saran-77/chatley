import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { motion, useReducedMotion } from "framer-motion"

import { useAuth } from "@/auth/auth-provider"
import { CollapsibleSection } from "@/components/collapsible-section"
import { MotionToast } from "@/components/motion-toast"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { fadeSlide } from "@/lib/motion"
import { supabase } from "@/lib/supabase"

export function SettingsPage() {
  const { profile, refreshProfile, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "")
  const [status, setStatus] = useState(profile?.status ?? "")
  const [message, setMessage] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const enter = fadeSlide(reduced, 0, 10)

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "")
    setStatus(profile?.status ?? "")
  }, [profile])

  return (
    <motion.div className="mx-auto flex h-svh max-w-lg flex-col gap-6 overflow-y-auto p-6" {...enter}>
      <div>
        <h1 className="text-xl font-medium">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update how you appear to people in your chats.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{(profile?.display_name ?? "You").slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{profile?.display_name}</p>
          <p className="text-xs text-muted-foreground">{profile?.status || "No status"}</p>
        </div>
      </div>
      <label className="grid gap-1 text-sm">
        Display name
        <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        Status
        <Input value={status} onChange={(event) => setStatus(event.target.value)} />
      </label>
      <Button
        className="accent-glow"
        onClick={async () => {
          if (!profile) return
          const { error } = await supabase
            .from("profiles")
            .update({ display_name: displayName, status })
            .eq("id", profile.id)
          if (error) setMessage(error.message)
          else {
            await refreshProfile()
            setMessage("Saved")
          }
        }}
      >
        Save profile
      </Button>
      <CollapsibleSection title="Theme">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Light or dark appearance</span>
          <ThemeToggle />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Delete account"
        defaultOpen={false}
        className="mt-auto border-destructive/30"
      >
        <p className="text-sm text-muted-foreground">
          Permanently remove your profile and leave every chat. Messages you already
          sent stay for people still in those conversations.
        </p>
        <Button
          className="mt-3"
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
        >
          Delete account
        </Button>
      </CollapsibleSection>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Your account and memberships are removed.
              Chats other people are in will remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true)
                const result = await deleteAccount()
                if (result.error) {
                  setMessage(result.error)
                  setDeleting(false)
                  setConfirmOpen(false)
                  return
                }
                navigate("/login", { replace: true })
              }}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MotionToast message={message} onClear={() => setMessage(null)} />
    </motion.div>
  )
}
