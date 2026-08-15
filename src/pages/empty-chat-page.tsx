import { EmptyLottie } from "@/components/empty-lottie"

export function EmptyChatPage() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <EmptyLottie label="Pick a conversation" />
      <h1 className="text-lg font-medium">Pick a conversation</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Choose a chat from the sidebar, or start a new one.
      </p>
    </div>
  )
}
