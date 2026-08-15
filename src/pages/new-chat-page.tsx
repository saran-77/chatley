import { ArrowLeft, Check, ImagePlus } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/auth/auth-provider"
import { useIdentity } from "@/auth/identity-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createDirectMessage, createGroupChat } from "@/hooks/use-conversations"
import { easeOut, fadeSlide, springPop } from "@/lib/motion"
import { supabase } from "@/lib/supabase"

export function NewChatPage() {
  const { user } = useAuth()
  const { secretKey } = useIdentity()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const photoRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [groupName, setGroupName] = useState("")
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const isGroup = selected.length > 1
  const enter = fadeSlide(reduced, 0, 12)

  const { data: people = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user?.id ?? "")
        .order("display_name")
      if (fetchError) throw fetchError
      return data ?? []
    },
    enabled: Boolean(user?.id),
  })

  const filtered = useMemo(
    () =>
      people.filter((person) =>
        person.display_name.toLowerCase().includes(query.toLowerCase()),
      ),
    [people, query],
  )

  return (
    <motion.div
      className="mx-auto flex h-dvh max-w-lg flex-col gap-4 p-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      {...enter}
    >
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon-sm" className="mt-0.5 md:hidden" asChild>
          <Link to="/" aria-label="Back to chats">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-medium">New chat</h1>
          <p className="text-sm text-muted-foreground">
            Pick one person for a DM, or several to start a group.
          </p>
        </div>
      </div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people"
        aria-label="Search people"
      />
      <AnimatePresence initial={false}>
        {isGroup ? (
          <motion.div
            className="flex items-center gap-3 overflow-hidden"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={reduced ? { duration: 0.15 } : easeOut}
          >
            <button
              type="button"
              className="flex size-12 items-center justify-center overflow-hidden rounded-full border bg-muted"
              aria-label="Choose group photo"
              onClick={() => photoRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-4 text-muted-foreground" />
              )}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (!file) return
                setGroupPhoto(file)
                setPhotoPreview(URL.createObjectURL(file))
              }}
            />
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Group name (required)"
              aria-label="Group name"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="glass-panel min-h-0 flex-1 overflow-y-auto rounded-xl">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No one else is on Chatley yet.
          </p>
        ) : (
          filtered.map((person, index) => {
            const checked = selected.includes(person.id)
            return (
              <motion.button
                key={person.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/70"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...(reduced ? { duration: 0.15 } : easeOut),
                  delay: reduced ? 0 : Math.min(index, 10) * 0.04,
                }}
                whileHover={reduced ? undefined : { scale: 1.01 }}
                onClick={() => {
                  setSelected((current) =>
                    checked
                      ? current.filter((id) => id !== person.id)
                      : [...current, person.id],
                  )
                }}
              >
                <Avatar>
                  <AvatarImage src={person.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{person.display_name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">{person.display_name}</span>
                <span className="flex size-6 items-center justify-center">
                    <AnimatePresence>
                      {checked ? (
                        <motion.span
                          key="check"
                          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                          transition={reduced ? { duration: 0.12 } : springPop}
                          className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),oklch(0.48_0.08_145)_32%)] text-primary-foreground"
                        >
                          <Check className="size-3.5" />
                        </motion.span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Select</span>
                      )}
                    </AnimatePresence>
                  </span>
              </motion.button>
            )
          })
        )}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        className="accent-glow"
        disabled={
          !user ||
          !secretKey ||
          selected.length === 0 ||
          pending ||
          (isGroup && !groupName.trim())
        }
        onClick={async () => {
          if (!user || !secretKey) return
          try {
            setPending(true)
            setError(null)
            const id =
              selected.length === 1
                ? await createDirectMessage(user.id, selected[0], secretKey)
                : await createGroupChat(
                    user.id,
                    groupName.trim(),
                    selected,
                    secretKey,
                    groupPhoto ?? undefined,
                  )
            navigate(`/c/${id}`)
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create chat")
          } finally {
            setPending(false)
          }
        }}
      >
        {isGroup ? "Create group" : "Start chat"}
      </Button>
    </motion.div>
  )
}
