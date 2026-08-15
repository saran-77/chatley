import { Button } from "@/components/ui/button"
import { acceptInvite, declineInvite } from "@/hooks/use-conversations"
import { useQueryClient } from "@tanstack/react-query"

export function InviteActions({
  conversationId,
  userId,
  onDeclined,
}: {
  conversationId: string
  userId: string
  onDeclined?: () => void
}) {
  const queryClient = useQueryClient()
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() => {
          void acceptInvite(conversationId, userId).then(() =>
            queryClient.invalidateQueries({ queryKey: ["conversations", userId] }),
          )
        }}
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void declineInvite(conversationId, userId).then(() => {
            void queryClient.invalidateQueries({ queryKey: ["conversations", userId] })
            onDeclined?.()
          })
        }}
      >
        Decline
      </Button>
    </div>
  )
}
