const APP_TITLE = "Chatley"
const DEFAULT_FAVICON = "/favicon.svg"
const BUBBLE =
  "M9 11.5A3.5 3.5 0 0 1 12.5 8h7A3.5 3.5 0 0 1 23 11.5v6a3.5 3.5 0 0 1-3.5 3.5H16l-4.5 3.2V21h-.001A3.5 3.5 0 0 1 9 17.5v-6Z"

function badgeLabel(count: number) {
  return count > 9 ? "9+" : String(count)
}

function roundRect(ctx: CanvasRenderingContext2D, size: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ctx.arcTo(size, 0, size, size, radius)
  ctx.arcTo(size, size, 0, size, radius)
  ctx.arcTo(0, size, 0, 0, radius)
  ctx.arcTo(0, 0, size, 0, radius)
  ctx.closePath()
}

function badgedFavicon(count: number) {
  const canvas = document.createElement("canvas")
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext("2d")
  if (!ctx) return DEFAULT_FAVICON

  ctx.fillStyle = "#E36A4A"
  roundRect(ctx, 32, 8)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.fill(new Path2D(BUBBLE))

  const label = badgeLabel(count)
  ctx.fillStyle = "#dc2626"
  ctx.beginPath()
  ctx.arc(24, 8, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = `bold ${label.length > 1 ? 10 : 12}px system-ui,sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(label, 24, 9)
  return canvas.toDataURL("image/png")
}

function setFavicon(href: string, type: string) {
  for (const existing of document.querySelectorAll("link[rel~='icon']")) existing.remove()
  const link = document.createElement("link")
  link.rel = "icon"
  link.type = type
  if (type === "image/png") link.sizes = "32x32"
  link.href = href
  document.head.appendChild(link)
}

export function applyTabUnread(count: number) {
  document.title = count > 0 ? `(${count}) ${APP_TITLE}` : APP_TITLE
  try {
    if (count > 0) {
      setFavicon(badgedFavicon(count), "image/png")
      return
    }
    setFavicon(DEFAULT_FAVICON, "image/svg+xml")
  } catch {
    // Title still updates if the favicon canvas is unavailable.
  }
}
