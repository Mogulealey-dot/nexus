// Node.js runtime — Transformers.js needs Node, not Edge
import { createServerClient } from '@supabase/ssr'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null

async function getEmbedder() {
  if (!embedder) {
    const { pipeline } = await import('@xenova/transformers')
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return embedder
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k, v.join('=')] })
  )
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { text } = await request.json() as { text: string }
  if (!text?.trim()) return Response.json({ embedding: null })

  const embed = await getEmbedder()
  const output = await embed(text.slice(0, 512), { pooling: 'mean', normalize: true })
  const embedding = Array.from(output.data)

  return Response.json({ embedding })
}
