import { Check, CheckCheck } from "lucide-react"

import { cn } from "@/lib/utils"

export function ReadReceipt({ read }: { read: boolean }) {
  return (
    <span
      className={cn("inline-flex", read ? "opacity-100" : "opacity-75")}
      aria-label={read ? "Read" : "Sent"}
    >
      {read ? <CheckCheck className="size-3.5" /> : <Check className="size-3.5" />}
    </span>
  )
}
