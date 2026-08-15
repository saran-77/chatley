import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

import { downloadChatFile, getChatMediaUrl } from "@/lib/media"
import type { MediaPayload } from "@/lib/payload"

export function useChatMediaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["chat-media-url", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: () => getChatMediaUrl(path!),
  })
}

export function useChatMediaObjectUrl(payload: MediaPayload | null | undefined, key?: Uint8Array) {
  const query = useQuery({
    queryKey: ["chat-media-object", payload?.path, payload?.mediaNonce, Boolean(key)],
    enabled: Boolean(payload?.path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const blob = await downloadChatFile(payload!, key)
      return URL.createObjectURL(blob)
    },
  })
  useEffect(() => {
    const url = query.data
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [query.data])
  return query
}
