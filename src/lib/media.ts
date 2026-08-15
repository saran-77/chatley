import type { FilePayload, ImagePayload, MediaPayload, VoicePayload } from "@/lib/payload"
import { IMAGE_MAX_BYTES } from "@/lib/payload"
import { decryptMediaBytes, encryptMediaBytes } from "@/lib/envelope"
import { supabase } from "@/lib/supabase"

function toBlob(bytes: Uint8Array, type = "application/octet-stream") {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type })
}

async function uploadBytes(conversationId: string, bytes: Uint8Array, contentType: string) {
  const path = `${conversationId}/${crypto.randomUUID()}`
  const { error } = await supabase.storage.from("chat-media").upload(path, toBlob(bytes, contentType), {
    contentType,
    upsert: false,
  })
  if (error) throw error
  return path
}

async function encryptAndUpload(conversationId: string, file: Blob, key: Uint8Array) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { mediaNonce, ciphertext } = encryptMediaBytes(key, bytes)
  const path = await uploadBytes(conversationId, ciphertext, "application/octet-stream")
  return { path, mediaNonce, size: file.size }
}

export async function uploadChatFile(
  conversationId: string,
  file: File,
  key: Uint8Array,
): Promise<FilePayload> {
  const uploaded = await encryptAndUpload(conversationId, file, key)
  return {
    kind: "file",
    path: uploaded.path,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: uploaded.size,
    mediaNonce: uploaded.mediaNonce,
  }
}

export async function uploadChatImage(
  conversationId: string,
  file: File,
  key: Uint8Array,
): Promise<ImagePayload> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file")
  if (file.size > IMAGE_MAX_BYTES) throw new Error("Images must be 10MB or smaller")
  const uploaded = await encryptAndUpload(conversationId, file, key)
  return {
    kind: "image",
    path: uploaded.path,
    name: file.name,
    mime: file.type || "image/jpeg",
    size: uploaded.size,
    mediaNonce: uploaded.mediaNonce,
  }
}

export async function uploadChatVoice(
  conversationId: string,
  file: File,
  durationMs: number,
  key: Uint8Array,
): Promise<VoicePayload> {
  const uploaded = await encryptAndUpload(conversationId, file, key)
  return {
    kind: "voice",
    path: uploaded.path,
    name: file.name,
    mime: file.type || "audio/webm",
    size: uploaded.size,
    durationMs,
    mediaNonce: uploaded.mediaNonce,
  }
}

function fileExtension(name: string) {
  const index = name.lastIndexOf(".")
  return index >= 0 ? name.slice(index) : ""
}

export async function uploadGroupAvatar(conversationId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file")
  if (file.size > IMAGE_MAX_BYTES) throw new Error("Images must be 10MB or smaller")
  const path = `${conversationId}/avatar-${crypto.randomUUID()}${fileExtension(file.name) || ".jpg"}`
  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  })
  if (error) throw error
  return path
}

export async function getChatMediaUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) throw error ?? new Error("Could not load file")
  return data.signedUrl
}

export async function downloadChatFile(payload: MediaPayload, key?: Uint8Array) {
  const { data, error } = await supabase.storage.from("chat-media").download(payload.path)
  if (error || !data) throw error ?? new Error("Could not download file")
  const raw = new Uint8Array(await data.arrayBuffer())
  if (payload.mediaNonce && key) {
    const plain = decryptMediaBytes(key, payload.mediaNonce, raw)
    return toBlob(plain, payload.mime)
  }
  return toBlob(raw, payload.mime)
}

export async function uploadUserAvatar(userId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file")
  if (file.size > IMAGE_MAX_BYTES) throw new Error("Images must be 10MB or smaller")
  const path = `${userId}/avatar${fileExtension(file.name) || ".jpg"}`
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  })
  if (error) throw error
  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
