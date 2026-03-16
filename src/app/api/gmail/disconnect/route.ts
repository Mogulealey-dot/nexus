import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { google } from 'googleapis'

export async function DELETE() {
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
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  // Revoke token with Google
  if (tokenRow?.access_token) {
    try {
      const oAuth2 = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!
      )
      oAuth2.setCredentials({ access_token: tokenRow.access_token })
      await oAuth2.revokeCredentials()
    } catch {
      // Revocation failure is non-fatal
    }
  }

  await serviceSupabase.from('gmail_tokens').delete().eq('user_id', user.id)

  return new Response(null, { status: 204 })
}
