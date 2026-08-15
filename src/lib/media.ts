import type { FilePayload, ImagePayload, MediaPayload, VoicePayload } from "@/lib/payload"
import { IMAGE_MAX_BYTES } from "@/lib/payload"
import { supabase } from "@/lib/supabase"

async function uploadMedia(conversationId: string, file: File) {
  const path = `${conversationId}/${crypto.randomUUID()}`
  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function uploadChatFile(
  conversationId: string,
  file: File,
): Promise<FilePayload> {
  const path = await uploadMedia(conversationId, file)
  return {
    kind: "file",
    path,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
  }
}

export async function uploadChatImage(
  conversationId: string,
  file: File,
): Promise<ImagePayload> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file")
  if (file.size > IMAGE_MAX_BYTES) throw new Error("Images must be 10MB or smaller")
  const path = await uploadMedia(conversationId, file)
  return {
    kind: "image",
    path,
    name: file.name,
    mime: file.type || "image/jpeg",
    size: file.size,
  }
}

export async function uploadChatVoice(
  conversationId: string,
  file: File,
  durationMs: number,
): Promise<VoicePayload> {
  const path = await uploadMedia(conversationId, file)
  return {
    kind: "voice",
    path,
    name: file.name,
    mime: file.type || "audio/webm",
    size: file.size,
    durationMs,
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

export async function downloadChatFile(payload: MediaPayload) {
  const { data, error } = await supabase.storage.from("chat-media").download(payload.path)
  if (error || !data) throw error ?? new Error("Could not download file")
  return new Blob([data], { type: payload.mime })
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
