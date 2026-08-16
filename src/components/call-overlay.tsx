import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react"
import { useEffect, useRef } from "react"

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
    return () => {
      node.srcObject = null
    }
  }, [stream])
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />
}

export function CallOverlay() {
  const call = useCall()
  const remoteVideo = Boolean(call.remoteStream?.getVideoTracks().some((track) => track.enabled && track.readyState === "live"))
  const localVideo = Boolean(call.cameraOn && call.localStream?.getVideoTracks().some((track) => track.enabled))
  const inCall = call.phase !== "idle"

  if (!inCall) {
    return <MotionToast message={call.error} onClear={clearCallError} />
  }

  const status =
    call.phase === "incoming"
      ? call.wantVideo
        ? "Incoming video call"
        : "Incoming call"
      : call.phase === "outgoing"
        ? "Calling…"
        : call.phase === "connecting"
          ? "Connecting…"
          : call.wantVideo || remoteVideo
            ? "Video call"
            : "Voice call"

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="relative min-h-0 flex-1">
        {remoteVideo ? (
          <CallVideo stream={call.remoteStream} className="size-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
            <ConversationAvatar
              size="lg"
              title={call.peerName || "Call"}
              fallbackUrl={call.peerAvatar}
            />
            <p className="text-lg font-medium">{call.peerName || "Call"}</p>
            <p className="text-sm text-muted-foreground">{status}</p>
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              Calls use WebRTC in the browser. Audio and video are encrypted in
              transit. This is not Signal-style calling.
            </p>
          </div>
        )}
        {localVideo ? (
          <CallVideo
            stream={call.localStream}
            muted
            className="absolute right-4 bottom-4 h-36 w-28 rounded-xl border bg-black object-cover shadow-lg"
          />
        ) : null}
      </div>

      {call.phase === "incoming" ? (
        <div className="flex justify-center gap-4 px-4 py-5">
          <Button variant="destructive" className="min-w-28" onClick={() => void declineCall()}>
            <PhoneOff />
            Decline
          </Button>
          <Button className="min-w-28" onClick={() => void acceptCall()}>
            {call.wantVideo ? <Video /> : <Phone />}
            Accept
          </Button>
        </div>
      ) : (
        <div className="flex justify-center gap-3 px-4 py-5">
          {call.phase === "outgoing" || call.phase === "connecting" ? (
            <p className="sr-only">{status}</p>
          ) : null}
          <Button
            variant={call.muted ? "secondary" : "outline"}
            size="icon-lg"
            aria-label={call.muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {call.muted ? <MicOff /> : <Mic />}
          </Button>
          <Button
            variant={call.cameraOn ? "secondary" : "outline"}
            size="icon-lg"
            aria-label={call.cameraOn ? "Turn camera off" : "Turn camera on"}
            onClick={() => void toggleCamera()}
          >
            {call.cameraOn ? <Video /> : <VideoOff />}
          </Button>
          <Button
            variant="destructive"
            size="icon-lg"
            aria-label="Hang up"
            onClick={hangupCall}
          >
            <PhoneOff />
          </Button>
        </div>
      )}
    </div>
  )
}
