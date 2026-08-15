import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const PRIVATE_HOST =
  /^(localhost|.*\.local|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|::1|fd[0-9a-f:]+|fe80:)/i

function meta(html: string, key: string) {
  const property = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i",
  )
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  )
  return html.match(property)?.[1] ?? html.match(contentFirst)?.[1] ?? undefined
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }
  try {
    const { url } = (await req.json()) as { url?: string }
    if (!url || typeof url !== "string") {
      return json({ error: "Missing url" }, 400)
    }
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return json({ error: "Unsupported protocol" }, 400)
    }
    if (PRIVATE_HOST.test(parsed.hostname)) {
      return json({ error: "Private hosts are blocked" }, 400)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "ChatleyUnfurl/1.0" },
    })
    clearTimeout(timer)
    const html = await response.text()
    const title =
      meta(html, "og:title") ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    const description = meta(html, "og:description") ?? meta(html, "description")
    const image = meta(html, "og:image")
    return json({
      url: parsed.toString(),
      title,
      description,
      image,
    })
  } catch {
    return json({ error: "Could not unfurl" }, 422)
  }
})
