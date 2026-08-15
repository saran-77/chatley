export type LinkPreview = {
  url: string
  title?: string
  description?: string
  image?: string
}

export type TextPayload = {
  kind: "text"
  text: string
  previews?: LinkPreview[]
}

export type FilePayload = {
  kind: "file"
  path: string
  name: string
  mime: string
  size: number
}

export type ImagePayload = {
  kind: "image"
  path: string
  name: string
  mime: string
  size: number
}

export type VoicePayload = {
  kind: "voice"
  path: string
  name: string
  mime: string
  size: number
  durationMs: number
}

export type MediaPayload = FilePayload | ImagePayload | VoicePayload
export type Payload = TextPayload | MediaPayload

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const VOICE_MAX_MS = 60_000
export const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi

export function extractUrls(text: string) {
  return [...new Set(text.match(URL_PATTERN) ?? [])].slice(0, 2)
}

export function serializePayload(payload: Payload): string {
  return JSON.stringify(payload)
}

export function parsePayload(raw: string): Payload | null {
  try {
    const parsed = JSON.parse(raw) as {
      kind?: string
      text?: string
      path?: string
      name?: string
      mime?: string
      size?: number
      durationMs?: number
      previews?: LinkPreview[]
    }
    if (parsed?.kind === "text" && typeof parsed.text === "string") {
      return {
        kind: "text",
        text: parsed.text,
        previews: Array.isArray(parsed.previews) ? parsed.previews : undefined,
      }
    }
    if (typeof parsed.path !== "string" || typeof parsed.name !== "string") {
      return null
    }
    const base = {
      path: parsed.path,
      name: parsed.name,
      mime: parsed.mime || "application/octet-stream",
      size: parsed.size ?? 0,
    }
    if (parsed.kind === "image") return { kind: "image", ...base }
    if (parsed.kind === "voice") {
      return { kind: "voice", ...base, durationMs: parsed.durationMs ?? 0 }
    }
    if (parsed.kind === "file" || parsed.kind === "media") {
      return { kind: "file", ...base }
    }
    return null
  } catch {
    return { kind: "text", text: raw }
  }
}

export function previewText(payload: Payload | null): string {
  if (!payload) return "No messages yet"
  if (payload.kind === "text") return payload.text
  if (payload.kind === "image") return "Photo"
  if (payload.kind === "voice") return "Voice message"
  return payload.name || "File"
}

export function snippetText(payload: Payload | null, fallback = "Message") {
  const text = previewText(payload)
  if (!payload) return fallback
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}
