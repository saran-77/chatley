import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"

import { useAuth } from "@/auth/auth-provider"
import { ConversationAvatar } from "@/components/conversation-avatar"
import { MotionToast } from "@/components/motion-toast"
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
import type { ConversationItem } from "@/hooks/use-conversations"
import {
  addGroupMembers,
  inviteUrl,
  leaveGroup,
  renameGroup,
  setGroupAvatar,
} from "@/hooks/use-conversations"
import { easeOut } from "@/lib/motion"
import { supabase } from "@/lib/supabase"

export function GroupInfoDialog({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: ConversationItem
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const photoRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(conversation.name ?? "")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [addQuery, setAddQuery] = useState("")

  useEffect(() => {
    setName(conversation.name ?? "")
  }, [conversation.name])

  const memberIds = useMemo(
    () => new Set(conversation.members.map((member) => member.id)),
    [conversation.members],
  )

  const { data: people = [] } = useQuery({
    queryKey: ["profiles"],
    enabled: open,
    queryFn: async () => {
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .order("display_name")
      if (fetchError) throw fetchError
      return data ?? []
    },
  })

  const candidates = people.filter(
    (person) =>
      !memberIds.has(person.id) &&
      person.display_name.toLowerCase().includes(addQuery.toLowerCase()),
  )

  async function refresh() {
    if (!user?.id) return
    await queryClient.invalidateQueries({ queryKey: ["conversations", user.id] })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group info</DialogTitle>
          <DialogDescription>
            {conversation.members.filter((member) => member.membershipStatus === "joined").length} members
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full"
            aria-label="Change group photo"
            onClick={() => photoRef.current?.click()}
          >
            <ConversationAvatar
              size="lg"
              title={conversation.name ?? "Group"}
              avatarPath={conversation.avatarPath}
            />
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              try {
                setBusy(true)
                setError(null)
                await setGroupAvatar(conversation.id, file)
                await refresh()
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not update photo")
              } finally {
                setBusy(false)
              }
            }}
          />
          <div className="min-w-0 flex-1">
            <label className="grid gap-1 text-sm">
              Group name
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label="Group name"
              />
            </label>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(inviteUrl(conversation.inviteToken))
            setCopied(true)
          }}
        >
          {copied ? "Link copied" : "Copy invite link"}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !name.trim() || name.trim() === (conversation.name ?? "")}
          onClick={async () => {
            try {
              setBusy(true)
              setError(null)
              await renameGroup(conversation.id, name.trim())
              await refresh()
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not rename group")
            } finally {
              setBusy(false)
            }
          }}
        >
          Save name
        </Button>
        <div>
          <p className="mb-2 text-sm font-medium">Members</p>
          <div className="max-h-40 overflow-y-auto rounded-xl border">
            {conversation.members.map((member, index) => (
              <motion.div
                key={member.id}
                className="flex items-center gap-2 px-3 py-2"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...(reduced ? { duration: 0.15 } : easeOut),
                  delay: reduced ? 0 : Math.min(index, 8) * 0.04,
                }}
              >
                <Avatar size="sm">
                  <AvatarImage src={member.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{member.display_name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">
                  {member.display_name}
                  {member.id === user?.id ? " (you)" : ""}
                </span>
                {member.membershipStatus === "pending" ? (
                  <span className="text-xs text-muted-foreground">Invited</span>
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Add people</p>
          <Input
            value={addQuery}
            onChange={(event) => setAddQuery(event.target.value)}
            placeholder="Search people"
            aria-label="Search people to add"
          />
          <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border">
            {candidates.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No one to add.</p>
            ) : (
              candidates.map((person, index) => (
                <motion.button
                  key={person.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                  disabled={busy}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...(reduced ? { duration: 0.15 } : easeOut),
                    delay: reduced ? 0 : Math.min(index, 8) * 0.04,
                  }}
                  whileTap={reduced ? undefined : { scale: 0.98 }}
                  onClick={async () => {
                    try {
                      setBusy(true)
                      setError(null)
                      await addGroupMembers(conversation.id, [person.id])
                      await refresh()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not add member")
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <Avatar size="sm">
                    <AvatarImage src={person.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{person.display_name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">{person.display_name}</span>
                  <span className="text-xs text-muted-foreground">Invite</span>
                </motion.button>
              ))
            )}
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={busy || !user}
            onClick={async () => {
              if (!user) return
              try {
                setBusy(true)
                await leaveGroup(conversation.id, user.id)
                await refresh()
                onOpenChange(false)
                navigate("/")
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not leave group")
                setBusy(false)
              }
            }}
          >
            Leave group
          </Button>
        </DialogFooter>
      </DialogContent>
      <MotionToast message={copied ? "Invite link copied" : null} onClear={() => setCopied(false)} />
    </Dialog>
  )
}
