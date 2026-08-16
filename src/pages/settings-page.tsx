import { ArrowLeft, Camera } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router"
import { motion, useReducedMotion } from "framer-motion"

import { useAuth } from "@/auth/auth-provider"
import { useIdentity } from "@/auth/identity-provider"
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
import { uploadUserAvatar } from "@/lib/media"
import { supabase } from "@/lib/supabase"
import { useQueryClient } from "@tanstack/react-query"

export function SettingsPage() {
  const { profile, refreshProfile, deleteAccount } = useAuth()
  const { changePassphrase } = useIdentity()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "")
  const [status, setStatus] = useState(profile?.status ?? "")
  const [message, setMessage] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [currentPass, setCurrentPass] = useState("")
  const [nextPass, setNextPass] = useState("")
  const [nextPassConfirm, setNextPassConfirm] = useState("")
  const [changingPass, setChangingPass] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const enter = fadeSlide(reduced, 0, 10)

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "")
    setStatus(profile?.status ?? "")
  }, [profile])

  return (
    <motion.div className="mx-auto flex h-dvh max-w-lg flex-col gap-6 overflow-y-auto p-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]" {...enter}>
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon-sm" className="mt-0.5 md:hidden" asChild>
          <Link to="/" aria-label="Back to chats">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-medium">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Update how you appear to people in your chats.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative"
          onClick={() => photoRef.current?.click()}
          aria-label="Change profile photo"
        >
          <Avatar size="lg">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
            <AvatarFallback>{(profile?.display_name ?? "You").slice(0, 2)}</AvatarFallback>
          </Avatar>
          <span className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
            <Camera className="size-3" />
          </span>
        </button>
        <div>
          <p className="text-sm font-medium">{profile?.display_name}</p>
          <p className="text-xs text-muted-foreground">
            {uploadingPhoto ? "Uploading photo…" : profile?.status || "No status"}
          </p>
        </div>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (!file || !profile) return
            setUploadingPhoto(true)
            try {
              const avatarUrl = await uploadUserAvatar(profile.id, file)
              const { error } = await supabase
                .from("profiles")
                .update({ avatar_url: avatarUrl })
                .eq("id", profile.id)
              if (error) throw error
              await refreshProfile()
              void queryClient.invalidateQueries({ queryKey: ["conversations", profile.id] })
              setMessage("Photo updated")
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Could not update photo")
            } finally {
              setUploadingPhoto(false)
            }
          }}
        />
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

      <CollapsibleSection title="Encryption">
        <p className="text-sm text-muted-foreground">
          Message bodies, attachments, typing pings, and read marks are encrypted in
          your browser. Link cards are built from the URL on this device and never
          sent to a preview server. Who is in a chat, timestamps, and last-seen still
          stay visible to the server. This is envelope encryption for a Google sign-in
          web app, not Signal-style device verification. In a direct chat you can
          compare a safety number in person; the verified mark stays only in this
          browser.
        </p>
        <label className="mt-3 grid gap-1 text-sm">
          Current passphrase
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPass}
            onChange={(event) => setCurrentPass(event.target.value)}
          />
        </label>
        <label className="mt-2 grid gap-1 text-sm">
          New passphrase
          <Input
            type="password"
            autoComplete="new-password"
            value={nextPass}
            onChange={(event) => setNextPass(event.target.value)}
          />
        </label>
        <label className="mt-2 grid gap-1 text-sm">
          Confirm new passphrase
          <Input
            type="password"
            autoComplete="new-password"
            value={nextPassConfirm}
            onChange={(event) => setNextPassConfirm(event.target.value)}
          />
        </label>
        <Button
          className="mt-3"
          variant="outline"
          disabled={changingPass}
          onClick={async () => {
            if (nextPass.length < 8) {
              setMessage("New passphrase must be at least 8 characters")
              return
            }
            if (nextPass !== nextPassConfirm) {
              setMessage("New passphrases do not match")
              return
            }
            setChangingPass(true)
            try {
              await changePassphrase(currentPass, nextPass)
              setCurrentPass("")
              setNextPass("")
              setNextPassConfirm("")
              setMessage("Passphrase updated")
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Could not update passphrase")
            } finally {
              setChangingPass(false)
            }
          }}
        >
          {changingPass ? "Updating…" : "Change passphrase"}
        </Button>
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
