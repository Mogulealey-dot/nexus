import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { google } from 'googleapis'

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''

  try {
    const drive = google.drive({ version: 'v3', auth: oAuth2 })

    const q = query
      ? `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`
      : 'trashed = false'

    const res = await drive.files.list({
      q,
      pageSize: 30,
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,owners)',
    })

    const files = (res.data.files || []).map(f => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      modifiedTime: f.modifiedTime!,
      size: f.size ? parseInt(f.size) : null,
      webViewLink: f.webViewLink || null,
      iconLink: f.iconLink || null,
      owner: f.owners?.[0]?.displayName || null,
    }))

    return Response.json({ connected: true, files })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('insufficientPermissions') || message.includes('Request had insufficient authentication scopes')) {
      return Response.json({ connected: true, insufficientScopes: true, files: [] })
    }
    return Response.json({ connected: true, files: [], error: message }, { status: 500 })
  }
}
