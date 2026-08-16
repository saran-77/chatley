import { ArrowLeft, Camera } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router"

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
import { uploadUserAvatar } from "@/lib/media"
import { supabase } from "@/lib/supabase"
import { useQueryClient } from "@tanstack/react-query"

export function SettingsPage() {
  const { profile, refreshProfile, deleteAccount } = useAuth()
  const { changePassphrase } = useIdentity()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
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

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "")
    setStatus(profile?.status ?? "")
  }, [profile])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-start gap-2 border-b bg-background/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6">
        <Button variant="ghost" size="icon-sm" className="mt-0.5 md:hidden" asChild>
          <Link to="/" aria-label="Back to chats">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-medium">Profile</h1>
          <p className="text-sm text-muted-foreground">
            How you appear, encryption, and account.
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-scroll overscroll-y-contain [scrollbar-gutter:stable] touch-pan-y">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-5 pb-[max(6rem,calc(env(safe-area-inset-bottom)+5.5rem))] sm:px-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-4 py-6 text-center">
            <button
              type="button"
              className="relative"
              onClick={() => photoRef.current?.click()}
              aria-label="Change profile photo"
            >
              <Avatar className="size-20">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{(profile?.display_name ?? "You").slice(0, 2)}</AvatarFallback>
              </Avatar>
              <span className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                <Camera className="size-3.5" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="truncate text-lg font-medium">{profile?.display_name ?? "You"}</p>
              <p className="truncate text-sm text-muted-foreground">
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

          <CollapsibleSection title="Profile">
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                Display name
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Status
                <Input value={status} onChange={(event) => setStatus(event.target.value)} />
              </label>
              <Button
                className="accent-glow w-full sm:w-auto"
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
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Appearance">
            <div className="flex items-center justify-between gap-4">
              <p className="min-w-0 text-sm text-muted-foreground">
                Light or dark on this device.
              </p>
              <div className="shrink-0">
                <ThemeToggle />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Encryption">
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Messages, attachments, typing, and read marks are encrypted in this
                browser. Chat members, timestamps, and last-seen stay visible to the
                server. This is envelope encryption, not Signal.
              </p>
              <label className="grid gap-1 text-sm">
                Current passphrase
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPass}
                  onChange={(event) => setCurrentPass(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                New passphrase
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={nextPass}
                  onChange={(event) => setNextPass(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Confirm new passphrase
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={nextPassConfirm}
                  onChange={(event) => setNextPassConfirm(event.target.value)}
                />
              </label>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
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
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Danger zone" className="border-destructive/40">
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Permanently remove your profile and leave every chat. Messages you
                already sent stay for people still in those conversations.
              </p>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setConfirmOpen(true)}
              >
                Delete account
              </Button>
            </div>
          </CollapsibleSection>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-card [background-color:var(--card)] backdrop-blur-none">
          <DialogHeader>
            <DialogTitle className="pr-10">Delete your account?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Your account and memberships are removed.
              Chats other people are in will remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row flex-wrap justify-end">
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
    </div>
  )
}
