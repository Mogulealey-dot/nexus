import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export interface GmailEmail {
  id: string
  from: string
  subject: string
  date: string
  snippet: string
  priority: 'HIGH' | 'NORMAL' | 'LOW'
  reason: string
  rank: number
}

const PRIORITY_ORDER = { HIGH: 1, NORMAL: 2, LOW: 3 }

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Load stored Gmail token
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tokenRow } = await serviceSupabase
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow) {
    return Response.json({ connected: false })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const oAuth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${appUrl}/api/gmail/callback`
  )

  oAuth2.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date,
  })

  // Persist refreshed tokens automatically
  oAuth2.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await serviceSupabase
        .from('gmail_tokens')
        .update({ access_token: tokens.access_token, expiry_date: tokens.expiry_date })
        .eq('user_id', user.id)
    }
  })

  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2 })

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 30,
    })

    const messages = listRes.data.messages || []
    if (messages.length === 0) {
      return Response.json({ connected: true, emails: [] })
    }

    // Fetch email metadata in parallel
    const emails = await Promise.all(
      messages.map(async ({ id }) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })
        const headers = msg.data.payload?.headers || []
        const get = (name: string) => headers.find(h => h.name === name)?.value || ''
        return {
          id: id!,
          from: get('From'),
          subject: get('Subject') || '(no subject)',
          date: get('Date'),
          snippet: msg.data.snippet || '',
        }
      })
    )

    // Ask Claude to prioritize
    const emailList = emails
      .map((e, i) =>
        `[${i + 1}] From: ${e.from}\n    Subject: ${e.subject}\n    Preview: ${e.snippet.slice(0, 120)}`
      )
      .join('\n\n')

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      maxOutputTokens: 2048,
      prompt: `You are an email triage assistant. Categorize each email as HIGH, NORMAL, or LOW priority.

HIGH: Urgent action required, deadlines, security alerts, critical issues, direct requests needing a response.
NORMAL: Informational updates, meeting invites, newsletters, non-urgent requests.
LOW: Promotions, marketing, social notifications, bulk mail.

Return a JSON array only (no markdown, no explanation):
[{"index": 1, "priority": "HIGH", "reason": "one sentence"}, ...]

Emails:
${emailList}`,
    })

    let priorities: { index: number; priority: 'HIGH' | 'NORMAL' | 'LOW'; reason: string }[] = []
    try {
      const raw = text.trim()
      const jsonText = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['))
      priorities = JSON.parse(jsonText)
    } catch {
      priorities = emails.map((_, i) => ({ index: i + 1, priority: 'NORMAL' as const, reason: 'Could not determine' }))
    }

    // Merge emails with priorities and sort by ascending rank (HIGH=1, NORMAL=2, LOW=3)
    const ranked: GmailEmail[] = emails.map((email, i) => {
      const p = priorities.find(x => x.index === i + 1)
      const priority = p?.priority ?? 'NORMAL'
      return {
        ...email,
        priority,
        reason: p?.reason ?? '',
        rank: PRIORITY_ORDER[priority],
      }
    })

    ranked.sort((a, b) => a.rank - b.rank)

    return Response.json({ connected: true, emails: ranked })
  } catch (err) {
    console.error('[gmail/emails]', err)
    return Response.json({ connected: true, emails: [], error: 'Failed to fetch emails' }, { status: 500 })
  }
}
