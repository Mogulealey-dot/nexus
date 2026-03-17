import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { google } from 'googleapis'

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

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tokenRow } = await serviceSupabase
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow) return Response.json({ connected: false })

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

  oAuth2.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await serviceSupabase
        .from('gmail_tokens')
        .update({ access_token: tokens.access_token, expiry_date: tokens.expiry_date })
        .eq('user_id', user.id)
    }
  })

  try {
    const tasks = google.tasks({ version: 'v1', auth: oAuth2 })

    // Get all task lists
    const listsRes = await tasks.tasklists.list({ maxResults: 20 })
    const lists = listsRes.data.items || []

    // Fetch tasks from each list
    const allTasks = await Promise.all(
      lists.map(async (list) => {
        const res = await tasks.tasks.list({
          tasklist: list.id!,
          showCompleted: false,
          showHidden: false,
          maxResults: 100,
        })
        return {
          listId: list.id!,
          listTitle: list.title || 'Tasks',
          items: (res.data.items || []).map(t => ({
            id: t.id!,
            title: t.title || '(No title)',
            status: t.status as 'needsAction' | 'completed',
            due: t.due || null,
            notes: t.notes || null,
            updated: t.updated || null,
          })),
        }
      })
    )

    return Response.json({ connected: true, lists: allTasks })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('insufficientPermissions') || message.includes('Request had insufficient authentication scopes')) {
      return Response.json({ connected: true, insufficientScopes: true, lists: [] })
    }
    return Response.json({ connected: true, lists: [], error: message }, { status: 500 })
  }
}
