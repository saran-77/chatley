import { useEffect, useSyncExternalStore } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { useAuth } from "@/auth/auth-provider"
import { iceServers } from "@/lib/ice-servers"
import { supabase } from "@/lib/supabase"

const RING_MS = 30_000

type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active"

export type CallSnapshot = {
  phase: CallPhase
  callId: string | null
  conversationId: string | null
  peerId: string | null
  peerName: string
  peerAvatar: string | null
  wantVideo: boolean
  muted: boolean
  cameraOn: boolean
  error: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
}

type Signal =
  | {
      kind: "ring"
      callId: string
      conversationId: string
      from: string
      fromName: string
      fromAvatar: string | null
      wantVideo: boolean
    }
  | { kind: "accept"; callId: string; from: string }
  | { kind: "decline"; callId: string; from: string }
  | { kind: "hangup"; callId: string; from: string }
  | { kind: "offer"; callId: string; from: string; sdp: string }
  | { kind: "answer"; callId: string; from: string; sdp: string }
  | { kind: "ice"; callId: string; from: string; candidate: RTCIceCandidateInit | null }

const idle: CallSnapshot = {
  phase: "idle",
  callId: null,
  conversationId: null,
  peerId: null,
  peerName: "",
  peerAvatar: null,
  wantVideo: false,
  muted: false,
  cameraOn: false,
  error: null,
  localStream: null,
  remoteStream: null,
}

let snapshot: CallSnapshot = idle
const listeners = new Set<() => void>()
let myUserId: string | null = null
let inbox: RealtimeChannel | null = null
let inboxJoin: Promise<void> | null = null
let inboxUsers = 0
const outbound = new Map<string, RealtimeChannel>()
const outboundWait = new Map<string, Promise<RealtimeChannel>>()
let pc: RTCPeerConnection | null = null
let pendingIce: RTCIceCandidateInit[] = []
let ringTimer = 0
let canNegotiate = false
let makingOffer = false
let isCaller = false

function emit() {
  listeners.forEach((listener) => listener())
}

function setState(patch: Partial<CallSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  emit()
}

function topic(userId: string) {
  return `calls:${userId}`
}

async function sendTo(peerId: string, payload: Signal) {
  let waiting = outboundWait.get(peerId)
  if (!waiting) {
    waiting = (async () => {
      const existing = outbound.get(peerId)
      if (existing) return existing
      const leftovers = supabase
        .getChannels()
        .filter((channel) => channel.topic === `realtime:${topic(peerId)}` && channel !== inbox)
      await Promise.all(leftovers.map((channel) => supabase.removeChannel(channel)))
      const channel = supabase.channel(topic(peerId))
      outbound.set(peerId, channel)
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Call signaling timed out")), 8000)
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            window.clearTimeout(timeout)
            resolve()
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            window.clearTimeout(timeout)
            reject(new Error("Could not reach them"))
          }
        })
      })
      return channel
    })()
    outboundWait.set(peerId, waiting)
  }
  try {
    const channel = await waiting
    await channel.send({ type: "broadcast", event: "signal", payload })
  } catch (error) {
    outbound.delete(peerId)
    outboundWait.delete(peerId)
    throw error
  }
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function clearRingTimer() {
  if (ringTimer) window.clearTimeout(ringTimer)
  ringTimer = 0
}

async function teardownPc() {
  canNegotiate = false
  makingOffer = false
  pendingIce = []
  clearRingTimer()
  if (pc) {
    pc.onicecandidate = null
    pc.ontrack = null
    pc.onnegotiationneeded = null
    pc.onconnectionstatechange = null
    pc.close()
  }
  pc = null
  stopStream(snapshot.localStream)
  stopStream(snapshot.remoteStream)
}

async function hangupInternal(notify: boolean) {
  const peerId = snapshot.peerId
  const callId = snapshot.callId
  const from = myUserId
  if (notify && peerId && callId && from) {
    void sendTo(peerId, { kind: "hangup", callId, from }).catch(() => undefined)
  }
  await teardownPc()
  isCaller = false
  setState({ ...idle })
}

async function createPc(stream: MediaStream) {
  await teardownPc()
  const connection = new RTCPeerConnection({ iceServers: iceServers() })
  pc = connection
  const remote = new MediaStream()
  stream.getTracks().forEach((track) => connection.addTrack(track, stream))
  if (!stream.getVideoTracks().length) {
    connection.addTransceiver("video", { direction: "sendrecv" })
  }
  connection.onicecandidate = (event) => {
    const peerId = snapshot.peerId
    const callId = snapshot.callId
    const from = myUserId
    if (!peerId || !callId || !from) return
    void sendTo(peerId, {
      kind: "ice",
      callId,
      from,
      candidate: event.candidate ? event.candidate.toJSON() : null,
    }).catch(() => undefined)
  }
  connection.ontrack = (event) => {
    const tracks = event.streams[0] ? event.streams[0].getTracks() : event.track ? [event.track] : []
    const current = snapshot.remoteStream ?? remote
    for (const track of tracks) {
      if (!current.getTracks().some((existing) => existing.id === track.id)) {
        current.addTrack(track)
      }
      track.onunmute = () => setState({ remoteStream: current })
      track.onmute = () => setState({ remoteStream: current })
      track.onended = () => setState({ remoteStream: current })
    }
    setState({ remoteStream: current })
  }
  connection.onnegotiationneeded = () => {
    if (!canNegotiate || !isCaller) return
    void (async () => {
      if (!pc || makingOffer || pc.signalingState !== "stable") return
      makingOffer = true
      try {
        await pc.setLocalDescription(await pc.createOffer())
        const peerId = snapshot.peerId
        const callId = snapshot.callId
        const from = myUserId
        const sdp = pc.localDescription?.sdp
        if (peerId && callId && from && sdp) {
          await sendTo(peerId, { kind: "offer", callId, from, sdp })
        }
      } catch {
        // Next negotiationneeded or hangup will recover.
      } finally {
        makingOffer = false
      }
    })()
  }
  connection.onconnectionstatechange = () => {
    if (connection.connectionState === "connected") {
      clearRingTimer()
      setState({ phase: "active", error: null })
    }
    if (connection.connectionState === "failed" || connection.connectionState === "closed") {
      if (snapshot.phase === "active" || snapshot.phase === "connecting") {
        void hangupInternal(false)
      }
    }
  }
  setState({ localStream: stream, remoteStream: remote })
}

async function flushIce() {
  if (!pc?.remoteDescription) return
  const queued = pendingIce
  pendingIce = []
  for (const candidate of queued) {
    try {
      await pc.addIceCandidate(candidate)
    } catch {
      // Stale candidate after hangup.
    }
  }
}

async function media(video: boolean) {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video })
  } catch (error) {
    if (video) {
      return navigator.mediaDevices.getUserMedia({ audio: true })
    }
    throw error
  }
}

async function handleSignal(payload: Signal) {
  if (!payload || payload.from === myUserId) return
  if (payload.kind === "ring") {
    if (snapshot.phase !== "idle") {
      void sendTo(payload.from, {
        kind: "decline",
        callId: payload.callId,
        from: myUserId!,
      }).catch(() => undefined)
      return
    }
    setState({
      phase: "incoming",
      callId: payload.callId,
      conversationId: payload.conversationId,
      peerId: payload.from,
      peerName: payload.fromName,
      peerAvatar: payload.fromAvatar,
      wantVideo: payload.wantVideo,
      muted: false,
      cameraOn: false,
      error: null,
    })
    return
  }
  if (!snapshot.callId || payload.callId !== snapshot.callId) return
  if (payload.kind === "decline" || payload.kind === "hangup") {
    const ended = payload.kind === "decline" ? "Declined" : null
    await teardownPc()
    isCaller = false
    setState({ ...idle, error: ended })
    return
  }
  if (payload.kind === "accept" && isCaller) {
    if (!pc) return
    clearRingTimer()
    setState({ phase: "connecting" })
    canNegotiate = false
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    canNegotiate = true
    if (offer.sdp && snapshot.peerId && myUserId) {
      await sendTo(snapshot.peerId, {
        kind: "offer",
        callId: payload.callId,
        from: myUserId,
        sdp: offer.sdp,
      })
    }
    return
  }
  if (payload.kind === "offer" && pc) {
    await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp })
    await flushIce()
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    if (answer.sdp && snapshot.peerId && myUserId) {
      await sendTo(snapshot.peerId, {
        kind: "answer",
        callId: payload.callId,
        from: myUserId,
        sdp: answer.sdp,
      })
    }
    canNegotiate = true
    return
  }
  if (payload.kind === "answer" && pc) {
    await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp })
    await flushIce()
    canNegotiate = true
    return
  }
  if (payload.kind === "ice") {
    if (!payload.candidate) return
    if (!pc?.remoteDescription) {
      pendingIce.push(payload.candidate)
      return
    }
    try {
      await pc.addIceCandidate(payload.candidate)
    } catch {
      // Ignore
    }
  }
}

async function joinInbox(userId: string) {
  inboxUsers += 1
  myUserId = userId
  if (inbox) return
  if (inboxJoin) {
    await inboxJoin
    return
  }
  inboxJoin = (async () => {
    const leftovers = supabase
      .getChannels()
      .filter((channel) => channel.topic === `realtime:${topic(userId)}`)
    await Promise.all(leftovers.map((channel) => supabase.removeChannel(channel)))
    const channel = supabase.channel(topic(userId))
    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      void handleSignal(payload as Signal)
    })
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve()
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve()
      })
    })
    inbox = channel
    if (inboxUsers === 0) {
      void supabase.removeChannel(channel)
      inbox = null
    }
  })()
  try {
    await inboxJoin
  } finally {
    inboxJoin = null
  }
}

function leaveInbox() {
  inboxUsers = Math.max(0, inboxUsers - 1)
  if (inboxUsers > 0 || !inbox) return
  void supabase.removeChannel(inbox)
  inbox = null
  for (const channel of outbound.values()) void supabase.removeChannel(channel)
  outbound.clear()
  outboundWait.clear()
}

export async function startCall(input: {
  conversationId: string
  peerId: string
  peerName: string
  peerAvatar: string | null
  selfName: string
  selfAvatar: string | null
  wantVideo: boolean
}) {
  if (!myUserId) return
  if (snapshot.phase !== "idle") return
  const callId = crypto.randomUUID()
  isCaller = true
  setState({
    phase: "outgoing",
    callId,
    conversationId: input.conversationId,
    peerId: input.peerId,
    peerName: input.peerName,
    peerAvatar: input.peerAvatar,
    wantVideo: input.wantVideo,
    muted: false,
    cameraOn: input.wantVideo,
    error: null,
  })
  try {
    const stream = await media(input.wantVideo)
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack && !input.wantVideo) videoTrack.enabled = false
    setState({ cameraOn: Boolean(input.wantVideo && videoTrack) })
    await createPc(stream)
    await sendTo(input.peerId, {
      kind: "ring",
      callId,
      conversationId: input.conversationId,
      from: myUserId,
      fromName: input.selfName,
      fromAvatar: input.selfAvatar,
      wantVideo: input.wantVideo,
    })
    clearRingTimer()
    ringTimer = window.setTimeout(() => {
      void (async () => {
        if (snapshot.phase !== "outgoing") return
        const peerId = snapshot.peerId
        const id = snapshot.callId
        if (peerId && id && myUserId) {
          void sendTo(peerId, { kind: "hangup", callId: id, from: myUserId }).catch(() => undefined)
        }
        await teardownPc()
        isCaller = false
        setState({ ...idle, error: "No answer" })
      })()
    }, RING_MS)
  } catch {
    await teardownPc()
    isCaller = false
    setState({
      ...idle,
      error: input.wantVideo
        ? "Camera or microphone permission is required for calls"
        : "Microphone permission is required for calls",
    })
  }
}

export async function acceptCall() {
  if (snapshot.phase !== "incoming" || !snapshot.peerId || !snapshot.callId || !myUserId) return
  isCaller = false
  setState({ phase: "connecting" })
  try {
    const stream = await media(snapshot.wantVideo)
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack && !snapshot.wantVideo) videoTrack.enabled = false
    setState({ cameraOn: Boolean(snapshot.wantVideo && videoTrack) })
    await createPc(stream)
    await sendTo(snapshot.peerId, {
      kind: "accept",
      callId: snapshot.callId,
      from: myUserId,
    })
  } catch {
    const peerId = snapshot.peerId
    const callId = snapshot.callId
    if (peerId && callId) {
      void sendTo(peerId, { kind: "hangup", callId, from: myUserId }).catch(() => undefined)
    }
    await teardownPc()
    isCaller = false
    setState({
      ...idle,
      error: snapshot.wantVideo
        ? "Camera or microphone permission is required for calls"
        : "Microphone permission is required for calls",
    })
  }
}

export async function declineCall() {
  if (snapshot.phase !== "incoming" || !snapshot.peerId || !snapshot.callId || !myUserId) {
    setState({ ...idle })
    return
  }
  const peerId = snapshot.peerId
  const callId = snapshot.callId
  void sendTo(peerId, { kind: "decline", callId, from: myUserId }).catch(() => undefined)
  setState({ ...idle })
}

export function hangupCall() {
  void hangupInternal(true)
}

export function toggleMute() {
  const next = !snapshot.muted
  snapshot.localStream?.getAudioTracks().forEach((track) => {
    track.enabled = !next
  })
  setState({ muted: next })
}

export async function toggleCamera() {
  if (!pc || !snapshot.localStream) return
  const current = snapshot.localStream.getVideoTracks()[0]
  if (current && current.enabled && snapshot.cameraOn) {
    current.enabled = false
    current.stop()
    snapshot.localStream.removeTrack(current)
    const sender = pc.getSenders().find((item) => item.track?.kind === "video")
    await sender?.replaceTrack(null)
    setState({ cameraOn: false, localStream: snapshot.localStream })
    return
  }
  try {
    const extra = await navigator.mediaDevices.getUserMedia({ video: true })
    const track = extra.getVideoTracks()[0]
    if (!track) return
    snapshot.localStream.addTrack(track)
    const videoSender =
      pc.getSenders().find((item) => item.track?.kind === "video") ??
      pc.getTransceivers().find((item) => item.receiver.track?.kind === "video")?.sender
    if (videoSender) await videoSender.replaceTrack(track)
    else pc.addTrack(track, snapshot.localStream)
    setState({ cameraOn: true, localStream: snapshot.localStream, wantVideo: true })
  } catch {
    setState({ error: "Camera permission is required for video" })
  }
}

export function clearCallError() {
  if (snapshot.phase === "idle") setState({ error: null })
}

export function useCall() {
  const { user } = useAuth()
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
    () => snapshot,
  )

  useEffect(() => {
    if (!user?.id) return
    void joinInbox(user.id)
    return () => {
      leaveInbox()
    }
  }, [user?.id])

  return state
}
