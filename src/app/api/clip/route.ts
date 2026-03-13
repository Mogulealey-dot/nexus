export const runtime = 'edge'

export async function POST(request: Request) {
  const { url } = await request.json() as { url: string }
  if (!url?.startsWith('http')) return new Response('Invalid URL', { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexusClipper/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch?.[1]?.trim() ?? new URL(url).hostname

    // Strip HTML tags to plain text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, '\n')
      .trim()
      .slice(0, 4000)

    return Response.json({ title, text })
  } catch {
    return new Response('Failed to fetch URL', { status: 502 })
  }
}
