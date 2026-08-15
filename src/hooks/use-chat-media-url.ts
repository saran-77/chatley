import { useQuery } from "@tanstack/react-query"

import { getChatMediaUrl } from "@/lib/media"

export function useChatMediaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["chat-media-url", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: () => getChatMediaUrl(path!),
  })
}
