export const runtime = 'edge'

import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map(c => { const [k, ...v] = c.trim().split('='); return [k.trim(), v.join('=')] })
      .filter(([k]) => k !== '') // drop blank keys from malformed cookie strings
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages, notesContext, currentPageTitle } = await request.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    notesContext?: string
    currentPageTitle?: string
  }

  const systemPrompt = `You are Nexus AI, an intelligent assistant built into the Nexus note-taking app.
You have access to the user's notes and help them find information, summarize content, brainstorm ideas, and answer questions.

Guidelines:
- Be concise and conversational — avoid long preambles
- When referencing a specific note, mention it by name
- If asked to summarize or search notes, use the context provided
- If asked to help write or improve text, be direct and give the result
- Keep responses focused and practical
${currentPageTitle ? `\nThe user is currently viewing a page called: "${currentPageTitle}"` : ''}
${notesContext ? `\nHere is relevant context from the user's notes:\n---\n${notesContext}\n---` : '\nThe user has no notes yet, or no relevant context was found.'}`

  try {
    const result = streamText({
      model: anthropic('claude-haiku-4-5'),
      system: systemPrompt,
      messages,
      maxOutputTokens: 1024,
      temperature: 0.7,
    })
    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[/api/ai/chat]', err)
    return new Response('AI service error', { status: 500 })
  }
}
