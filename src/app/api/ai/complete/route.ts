export const runtime = 'edge'

import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: Request) {
  // Auth check
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k, v.join('=')] }))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { prompt, context } = await request.json() as { prompt: string; context?: string }

  try {
    const result = streamText({
      model: anthropic('claude-haiku-4-5'),
      system: `You are an intelligent writing assistant embedded in a note-taking app called Project Nexus.
Your job is to complete the user's thought naturally and helpfully.
Rules:
- Continue the text seamlessly — do NOT repeat what was already written.
- Keep completions concise: 1-3 sentences max unless clearly needed.
- Match the tone and style of the existing text.
- Do not add greetings, explanations, or meta-commentary.
- If context is provided, use it to make smarter completions.`,
      messages: [
        ...(context ? [{ role: 'user' as const, content: `Context from my notes:\n${context}` }] : []),
        { role: 'user', content: `Complete this thought naturally:\n${prompt}` },
      ],
      maxOutputTokens: 200,
      temperature: 0.7,
    })
    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[/api/ai/complete]', err)
    return new Response('AI service error', { status: 500 })
  }
}
