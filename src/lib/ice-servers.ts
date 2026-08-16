export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }]
  const url = import.meta.env.VITE_TURN_URL?.trim()
  const username = import.meta.env.VITE_TURN_USERNAME?.trim()
  const credential = import.meta.env.VITE_TURN_CREDENTIAL?.trim()
  if (url && username && credential) {
    servers.push({ urls: [url], username, credential })
  }
  return servers
}
