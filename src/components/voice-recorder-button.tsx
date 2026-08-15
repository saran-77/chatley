import { Mic, Square, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { VOICE_MAX_MS } from "@/lib/payload"

function pickAudioMime() {
  if (typeof MediaRecorder === "undefined") return ""
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus"
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm"
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4"
  return ""
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function VoiceRecorderButton({
  disabled,
  onRecorded,
  onError,
}: {
  disabled?: boolean
  onRecorded: (file: File, durationMs: number) => Promise<void>
  onError: (message: string) => void
}) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const stopTimerRef = useRef<number>(0)

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current)
    stopTimerRef.current = 0
  }

  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      cleanupStream()
    }
  }, [])

  async function startRecording() {
    try {
      const mime = pickAudioMime()
      if (!mime && typeof MediaRecorder === "undefined") {
        onError("Voice notes are not supported in this browser")
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      } catch {
        cleanupStream()
        onError("Voice notes are not supported in this browser")
        return
      }
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      startedAtRef.current = Date.now()
      setElapsed(0)
      setRecording(true)
      recorder.start()
      stopTimerRef.current = window.setTimeout(() => {
        void stopRecording(true)
      }, VOICE_MAX_MS)
    } catch {
      cleanupStream()
      onError("Microphone permission is required for voice notes")
    }
  }

  async function stopRecording(send: boolean) {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") {
      setRecording(false)
      cleanupStream()
      return
    }
    const durationMs = Math.min(Date.now() - startedAtRef.current, VOICE_MAX_MS)
    const mime = recorder.mimeType || "audio/webm"
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })
    cleanupStream()
    recorderRef.current = null
    setRecording(false)
    setElapsed(0)
    if (!send || durationMs < 400) return
    const extension = mime.includes("mp4") ? "m4a" : "webm"
    const file = new File(chunksRef.current, `voice.${extension}`, { type: mime })
    await onRecorded(file, durationMs)
  }

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current)
    }, 200)
    return () => window.clearInterval(id)
  }, [recording])

  if (recording) {
    return (
      <div className="flex items-center gap-1">
        <span className="min-w-10 text-xs tabular-nums text-destructive">
          {formatDuration(elapsed)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 md:size-8"
          aria-label="Cancel recording"
          onClick={() => void stopRecording(false)}
        >
          <X />
        </Button>
        <Button
          type="button"
          size="icon"
          className="size-11 md:size-8"
          aria-label="Stop and send"
          onClick={() => void stopRecording(true)}
        >
          <Square />
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 md:size-8"
      aria-label="Record voice note"
      disabled={disabled}
      onClick={() => void startRecording()}
    >
      <Mic />
    </Button>
  )
}
