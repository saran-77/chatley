import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"

import { ConversationAvatar } from "@/components/conversation-avatar"
import { Button } from "@/components/ui/button"
import { joinByInviteToken } from "@/hooks/use-conversations"
import { supabase } from "@/lib/supabase"

export function InvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["invite-preview", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data: rows, error: previewError } = await supabase.rpc("preview_invite", {
        _token: token!,
      })
      if (previewError) throw previewError
      return rows?.[0] ?? null
    },
  })

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading invite…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">This invite link is invalid or expired.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to chats
        </Button>
      </div>
    )
  }

  const title = data.name ?? (data.type === "group" ? "Group chat" : "Chat")

  return (
    <div className="mx-auto flex h-svh max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <ConversationAvatar size="lg" title={title} avatarPath={data.avatar_path} />
      <div>
        <h1 className="text-lg font-medium">Join {title}</h1>
        <p className="text-sm text-muted-foreground">
          {data.type === "group" ? "You were invited to this group." : "Join this chat."}
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        className="w-full"
        disabled={pending}
        onClick={async () => {
          if (!token) return
          try {
            setPending(true)
            const id = await joinByInviteToken(token)
            navigate(`/c/${id}`, { replace: true })
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not join")
            setPending(false)
          }
        }}
      >
        Join
      </Button>
    </div>
  )
}
