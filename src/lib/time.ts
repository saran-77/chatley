export function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function formatLastSeen(iso: string | null | undefined) {
  if (!iso) return "Offline"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Offline"
  const diff = Date.now() - date.getTime()
  if (diff < 45_000) return "Last seen just now"
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(diff / 60_000))
    return `Last seen ${minutes} minute${minutes === 1 ? "" : "s"} ago`
  }
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  if (date >= startOfToday) {
    return `Last seen today at ${formatMessageTime(iso)}`
  }
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  if (date >= startOfYesterday) {
    return `Last seen yesterday at ${formatMessageTime(iso)}`
  }
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`
}
