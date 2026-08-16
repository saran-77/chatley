export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ]
  const url = import.meta.env.VITE_TURN_URL?.trim()
  const username = import.meta.env.VITE_TURN_USERNAME?.trim()
  const credential = import.meta.env.VITE_TURN_CREDENTIAL?.trim()
  if (url && username && credential) {
    servers.push({ urls: [url], username, credential })
  }
  return servers
}

export const audioConstraints: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
}

export const videoConstraints: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 24, max: 30 },
  facingMode: "user",
}

export async function tuneSenders(connection: RTCPeerConnection) {
  const audioCaps = RTCRtpSender.getCapabilities?.("audio")
  if (audioCaps?.codecs.length) {
    const opus = audioCaps.codecs.filter((codec) => /opus/i.test(codec.mimeType))
    const rest = audioCaps.codecs.filter((codec) => !/opus/i.test(codec.mimeType))
    if (opus.length) {
      for (const transceiver of connection.getTransceivers()) {
        if (transceiver.sender.track?.kind === "audio" || transceiver.receiver.track?.kind === "audio") {
          try {
            transceiver.setCodecPreferences([...opus, ...rest])
          } catch {
            // Safari may not allow codec preference changes.
          }
        }
      }
    }
  }
  for (const sender of connection.getSenders()) {
    if (!sender.track) continue
    const params = sender.getParameters()
    if (!params.encodings?.length) params.encodings = [{}]
    if (sender.track.kind === "audio") {
      params.encodings[0].maxBitrate = 64_000
    } else {
      params.encodings[0].maxBitrate = 1_200_000
      params.encodings[0].maxFramerate = 24
    }
    try {
      await sender.setParameters(params)
    } catch {
      // Parameters can be rejected before the first offer.
    }
  }
}
