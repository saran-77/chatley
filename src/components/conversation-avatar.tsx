import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useChatMediaUrl } from "@/hooks/use-chat-media-url"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function ConversationAvatar({
  title,
  avatarPath,
  fallbackUrl,
  size = "default",
}: {
  title: string
  avatarPath?: string | null
  fallbackUrl?: string | null
  size?: "default" | "sm" | "lg"
}) {
  const { data: signedUrl } = useChatMediaUrl(avatarPath)
  const src = signedUrl ?? fallbackUrl ?? undefined
  return (
    <Avatar size={size}>
      <AvatarImage src={src} alt="" />
      <AvatarFallback>{initials(title)}</AvatarFallback>
    </Avatar>
  )
}
