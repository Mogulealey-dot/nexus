import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const userId = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/gmail?error=access_denied`)
  }

  const oAuth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${appUrl}/api/gmail/callback`
  )

  try {
    const { tokens } = await oAuth2.getToken(code)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from('gmail_tokens').upsert(
      {
        user_id: userId,
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token ?? null,
        token_type: tokens.token_type ?? 'Bearer',
        expiry_date: tokens.expiry_date ?? null,
      },
      { onConflict: 'user_id' }
    )

    return NextResponse.redirect(`${appUrl}/gmail?connected=1`)
  } catch (err) {
    console.error('[gmail/callback]', err)
    return NextResponse.redirect(`${appUrl}/gmail?error=token_exchange`)
  }
}
