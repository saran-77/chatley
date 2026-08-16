import type { LinkPreview } from "@/lib/payload"

export function previewFromUrl(url: string): LinkPreview | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    const title = parsed.hostname.replace(/^www\./i, "")
    const rest = `${parsed.pathname}${parsed.search}`
    return {
      url: parsed.toString(),
      title,
      description: rest && rest !== "/" ? rest.replace(/^\//, "") : undefined,
    }
  } catch {
    return null
  }
}
