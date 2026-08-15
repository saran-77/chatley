import { Shield } from "lucide-react"
import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"

import { useIdentity } from "@/auth/identity-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CryptoError } from "@/lib/crypto"
import { springPop, staggerFast } from "@/lib/motion"

export function SetupKeysPage() {
  const { mode, backupCompatible, createKeys, unlock, resetKeys } = useIdentity()
  const reduced = useReducedMotion()
  const isCreate = mode === "create" || !backupCompatible
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [fresh, setFresh] = useState(!backupCompatible)

  const item = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 } }

  async function submit() {
    setError(null)
    if (passphrase.length < 8) {
      setError("Use at least 8 characters")
      return
    }
    if ((isCreate || fresh) && passphrase !== confirm) {
      setError("Passphrases do not match")
      return
    }
    setPending(true)
    try {
      if (isCreate || fresh) await (isCreate ? createKeys : resetKeys)(passphrase)
      else await unlock(passphrase)
    } catch (err) {
      setError(err instanceof CryptoError || err instanceof Error ? err.message : "Could not unlock")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <motion.div variants={staggerFast} initial="initial" animate="animate">
        <motion.div variants={item} transition={reduced ? { duration: 0.16 } : springPop}>
          <Card className="glass-panel w-full max-w-sm bg-transparent">
            <CardHeader className="space-y-3 text-center">
              <div className="accent-glow mx-auto flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),oklch(0.48_0.08_145)_30%)] text-primary-foreground">
                <Shield className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {isCreate || fresh ? "Protect your chats" : "Unlock this device"}
                </CardTitle>
                <CardDescription>
                  {isCreate || fresh
                    ? "Choose a passphrase to wrap your encryption keys. You will need it on new phones or after clearing site data."
                    : "Enter the passphrase you chose for Chatley encryption."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="grid gap-1 text-sm">
                Passphrase
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </label>
              {isCreate || fresh ? (
                <label className="grid gap-1 text-sm">
                  Confirm passphrase
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </label>
              ) : null}
              <Button className="w-full accent-glow" disabled={pending} onClick={() => void submit()}>
                {pending ? "Working…" : isCreate || fresh ? "Create keys" : "Unlock"}
              </Button>
              {error ? (
                <p className="text-center text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {!isCreate && !fresh ? (
                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground underline"
                  onClick={() => {
                    setFresh(true)
                    setError(null)
                  }}
                >
                  Forgot passphrase? Create new keys
                </button>
              ) : null}
              <p className="text-center text-xs text-muted-foreground">
                Chatley encrypts message bodies and attachments in your browser. Google sign-in
                does not replace this passphrase. This is not Signal-style device verification.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
