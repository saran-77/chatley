import { Check, Copy, ShieldAlert, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { VerificationStatus } from "@/hooks/use-peer-verification"
import { safetyNumberRows } from "@/lib/crypto"

export function SafetyNumberDialog({
  open,
  onOpenChange,
  name,
  status,
  number,
  onMarkVerified,
  onClear,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  status: VerificationStatus
  number: string | null
  onMarkVerified: () => Promise<void>
  onClear: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const rows = number ? safetyNumberRows(number) : []

  async function copyNumber() {
    if (!number) return
    try {
      await navigator.clipboard.writeText(number)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Safety number</DialogTitle>
          <DialogDescription>
            Compare this number with {name} in person or on a call you trust. It is
            derived from both of your identity keys on this device. Chatley cannot
            confirm who they are.
          </DialogDescription>
        </DialogHeader>

        {status === "changed" ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            A key changed since you last verified {name}. Compare the number again
            before trusting this chat.
          </p>
        ) : null}

        {status === "verified" ? (
          <p className="flex items-center gap-2 text-sm text-primary">
            <ShieldCheck className="size-4" />
            Verified on this browser
          </p>
        ) : null}

        {number ? (
          <div className="rounded-xl bg-muted/60 px-3 py-3 font-mono text-center text-sm tracking-wide">
            {rows.map((row) => (
              <p key={row.join("-")} className="tabular-nums">
                {row.join("  ")}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Both of you need encryption keys set up before a safety number is
            available.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" size="sm" disabled={!number} onClick={() => void copyNumber()}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {status === "verified" || status === "changed" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void run(onClear)}
              >
                Clear
              </Button>
            ) : null}
            {number ? (
              <Button
                size="sm"
                disabled={busy || status === "verified"}
                onClick={() => void run(onMarkVerified)}
              >
                {status === "changed" ? (
                  <ShieldAlert />
                ) : (
                  <ShieldCheck />
                )}
                {status === "verified" ? "Verified" : "Mark verified"}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
