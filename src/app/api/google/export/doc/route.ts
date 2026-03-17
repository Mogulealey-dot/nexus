import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { google } from 'googleapis'

export async function POST(request: Request) {
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

  if (!tokenRow) return Response.json({ error: 'Google account not connected' }, { status: 400 })

  const { title, html } = await request.json() as { title: string; html: string }
  if (!html) return Response.json({ error: 'No content provided' }, { status: 400 })

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
    const drive = google.drive({ version: 'v3', auth: oAuth2 })

    // Upload HTML and convert to Google Doc format automatically
    const res = await drive.files.create({
      requestBody: {
        name: title || 'Untitled',
        mimeType: 'application/vnd.google-apps.document',
      },
      media: {
        mimeType: 'text/html',
        body: html,
      },
      fields: 'id,webViewLink',
    })

    return Response.json({
      docId: res.data.id,
      webViewLink: res.data.webViewLink,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
