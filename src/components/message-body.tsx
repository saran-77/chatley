import { downloadChatFile } from "@/lib/media"
import { useChatMediaUrl } from "@/hooks/use-chat-media-url"
import type { LinkPreview, Payload } from "@/lib/payload"

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function ImageBubble({ payload }: { payload: Extract<Payload, { kind: "image" }> }) {
  const { data: url, isLoading } = useChatMediaUrl(payload.path)
  if (isLoading || !url) {
    return <p className="text-xs opacity-80">Loading photo…</p>
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={payload.name}
        className="max-h-64 max-w-full rounded-xl object-cover"
      />
    </a>
  )
}

function VoiceBubble({ payload }: { payload: Extract<Payload, { kind: "voice" }> }) {
  const { data: url, isLoading } = useChatMediaUrl(payload.path)
  if (isLoading || !url) {
    return <p className="text-xs opacity-80">Loading voice note…</p>
  }
  return (
    <div className="min-w-[180px]">
      <audio controls src={url} className="h-8 w-full" />
      <p className="mt-1 text-[11px] opacity-80">{formatDuration(payload.durationMs)}</p>
    </div>
  )
}

function FileBubble({ payload }: { payload: Extract<Payload, { kind: "file" }> }) {
  return (
    <button
      className="underline"
      type="button"
      onClick={async () => {
        const blob = await downloadChatFile(payload)
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = payload.name
        anchor.click()
        URL.revokeObjectURL(url)
      }}
    >
      {payload.name}
    </button>
  )
}

function TextWithLinks({ text }: { text: string }) {
  const tokens = text.split(/(https?:\/\/[^\s<>"']+)/gi)
  return (
    <p className="whitespace-pre-wrap">
      {tokens.map((token, index) =>
        /^https?:\/\//i.test(token) ? (
          <a
            key={`${token}-${index}`}
            href={token}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {token}
          </a>
        ) : (
          <span key={`${token}-${index}`}>{token}</span>
        ),
      )}
    </p>
  )
}

function PreviewCard({ preview }: { preview: LinkPreview }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block overflow-hidden rounded-xl border bg-background/40 text-left"
    >
      {preview.image ? (
        <img src={preview.image} alt="" className="max-h-36 w-full object-cover" />
      ) : null}
      <div className="p-2">
        <p className="truncate text-xs font-medium">{preview.title || preview.url}</p>
        {preview.description ? (
          <p className="line-clamp-2 text-[11px] opacity-80">{preview.description}</p>
        ) : null}
      </div>
    </a>
  )
}

export function MessageBody({
  payload,
  error,
}: {
  payload: Payload | null
  error?: string
}) {
  if (error) return <p className="italic opacity-80">{error}</p>
  if (!payload) return <p className="italic opacity-80">Empty message</p>
  if (payload.kind === "image") return <ImageBubble payload={payload} />
  if (payload.kind === "voice") return <VoiceBubble payload={payload} />
  if (payload.kind === "file") return <FileBubble payload={payload} />
  return (
    <div>
      <TextWithLinks text={payload.text} />
      {payload.previews?.map((preview) => (
        <PreviewCard key={preview.url} preview={preview} />
      ))}
    </div>
  )
}
