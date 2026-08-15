import { supabase } from "@/lib/supabase"
import type { LinkPreview } from "@/lib/payload"

export async function unfurlUrl(url: string): Promise<LinkPreview | null> {
  const { data, error } = await supabase.functions.invoke("unfurl", { body: { url } })
  if (error || !data) return null
  const preview = data as LinkPreview
  if (!preview.url) return null
  return preview
}
