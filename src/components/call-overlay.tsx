import { Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, Video, VideoOff } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { ConversationAvatar } from "@/components/conversation-avatar"
import { MotionToast } from "@/components/motion-toast"
import { Button } from "@/components/ui/button"
import {
  acceptCall,
  clearCallError,
  declineCall,
  hangupCall,
  toggleCamera,
  toggleMute,
  useCall,
} from "@/hooks/use-call"
import { cn } from "@/lib/utils"

function CallVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null
  muted?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.srcObject = stream
    void node.play().catch(() => undefined)
    return () => {
      node.srcObject = null
    }
  }, [stream])
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />
}

function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return
    const ctx = new AudioContext()
    let stopped = false
    const ding = (at: number, freq: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.07, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.24)
    }
    const ring = () => {
      if (stopped) return
      const now = ctx.currentTime
      ding(now, 880)
      ding(now + 0.28, 740)
    }
    void ctx.resume()
    ring()
    const id = window.setInterval(ring, 1600)
    return () => {
      stopped = true
      window.clearInterval(id)
      void ctx.close()
    }
  }, [active])
}

function useIncomingAlerts(active: boolean, name: string) {
  useEffect(() => {
    if (!active) return
    const previous = document.title
    let tick = false
    document.title = `${name} is calling`
    const id = window.setInterval(() => {
      tick = !tick
      document.title = tick ? `${name} is calling` : "Incoming call"
    }, 900)
    return () => {
      window.clearInterval(id)
      document.title = previous
    }
  }, [active, name])
}

export function CallOverlay() {
  const call = useCall()
  const [size, setSize] = useState<"min" | "normal" | "full">("normal")
  const showRemoteVideo = call.phase === "active" && call.remoteCameraOn
  const videoOff =
    call.phase === "active" && call.wantVideo && !call.remoteCameraOn
  const localVideo = Boolean(call.cameraOn && call.localStream?.getVideoTracks().some((track) => track.enabled))
  const incoming = call.phase === "incoming"
  const inCall = call.phase !== "idle"

  useRingtone(incoming)
  useIncomingAlerts(incoming, call.peerName || "Someone")

  useEffect(() => {
    if (call.phase === "idle") setSize("normal")
  }, [call.phase])

  if (!inCall) {
    return <MotionToast message={call.error} onClear={clearCallError} />
  }

  const status =
    call.phase === "incoming"
      ? call.wantVideo
        ? "Incoming video call"
        : "Incoming voice call"
      : call.phase === "outgoing"
        ? "Calling…"
        : call.phase === "connecting"
          ? "Connecting…"
          : videoOff
            ? "Video is turned off"
            : showRemoteVideo || call.cameraOn
              ? "Video call"
              : "Voice call"

  if (incoming) {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
        <div className="absolute inset-0 bg-black/45" />
        <div
          role="alertdialog"
          aria-live="assertive"
          aria-label={`${call.peerName || "Someone"} is calling`}
          className="relative z-10 w-full max-w-sm rounded-2xl border bg-card p-5 text-card-foreground shadow-2xl"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
              <ConversationAvatar
                size="lg"
                title={call.peerName || "Call"}
                fallbackUrl={call.peerAvatar}
              />
            </span>
            <div>
              <p className="text-lg font-medium">{call.peerName || "Someone"}</p>
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <Button variant="destructive" className="flex-1" onClick={() => void declineCall()}>
              <PhoneOff />
              Decline
            </Button>
            <Button className="flex-1" onClick={() => void acceptCall()}>
              {call.wantVideo ? <Video /> : <Phone />}
              Accept
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const controls = (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant={call.muted ? "secondary" : "outline"}
        size="icon-sm"
        aria-label={call.muted ? "Unmute" : "Mute"}
        onClick={toggleMute}
      >
        {call.muted ? <MicOff /> : <Mic />}
      </Button>
      <Button
        variant={call.cameraOn ? "secondary" : "outline"}
        size="icon-sm"
        aria-label={call.cameraOn ? "Turn camera off" : "Turn camera on"}
        onClick={() => void toggleCamera()}
      >
        {call.cameraOn ? <Video /> : <VideoOff />}
      </Button>
      <Button variant="destructive" size="icon-sm" aria-label="Hang up" onClick={hangupCall}>
        <PhoneOff />
      </Button>
    </div>
  )

  if (size === "min") {
    return (
      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex items-center gap-3 rounded-2xl border bg-card px-3 py-2 shadow-xl">
        <CallVideo stream={call.remoteStream} className="pointer-events-none absolute size-0 opacity-0" />
        <ConversationAvatar size="sm" title={call.peerName || "Call"} fallbackUrl={call.peerAvatar} />
        <div className="min-w-0">
          <p className="max-w-[10rem] truncate text-sm font-medium">{call.peerName || "Call"}</p>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
        {controls}
        <Button variant="ghost" size="icon-sm" aria-label="Expand call" onClick={() => setSize("normal")}>
          <Maximize2 />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "fixed z-[60] flex flex-col overflow-hidden border bg-card shadow-2xl",
        size === "full"
          ? "inset-0 rounded-none"
          : "right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] h-[min(32rem,calc(100dvh-2rem))] w-[min(24rem,calc(100vw-2rem))] rounded-2xl",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{call.peerName || "Call"}</p>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={size === "full" ? "Exit full screen" : "Full screen"}
            onClick={() => setSize(size === "full" ? "normal" : "full")}
          >
            <Maximize2 />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Minimize call" onClick={() => setSize("min")}>
            <Minimize2 />
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-muted/40">
        <CallVideo
          stream={call.remoteStream}
          className="pointer-events-none absolute size-0 opacity-0"
        />
        {showRemoteVideo ? (
          <CallVideo stream={call.remoteStream} className="size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
            <ConversationAvatar size="lg" title={call.peerName || "Call"} fallbackUrl={call.peerAvatar} />
            <p className="text-sm text-muted-foreground">
              {videoOff ? "Video is turned off" : status}
            </p>
          </div>
        )}
        {localVideo ? (
          <CallVideo
            stream={call.localStream}
            muted
            className="absolute right-3 bottom-3 h-28 w-20 rounded-xl border bg-black object-cover shadow-lg"
          />
        ) : null}
      </div>
      <div className="shrink-0 border-t px-3 py-3">{controls}</div>
    </div>
  )
}
