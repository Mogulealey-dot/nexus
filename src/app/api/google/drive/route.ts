import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { google } from 'googleapis'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

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
  const fileId = searchParams.get('id')
  const download = searchParams.get('download') === '1'

  try {
    const drive = google.drive({ version: 'v3', auth: oAuth2 })

    // Download and parse a specific file
    if (fileId && download) {
      const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType' })
      const mimeType = meta.data.mimeType || ''
      const name = meta.data.name || 'Untitled'

      // --- Excel (.xlsx / .xls / Google Sheets export) ---
      const isExcel =
        mimeType.includes('spreadsheetml') ||
        mimeType.includes('ms-excel') ||
        mimeType === 'application/vnd.google-apps.spreadsheet'

      if (isExcel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (drive.files.get as any)(
          { fileId, alt: mimeType === 'application/vnd.google-apps.spreadsheet' ? undefined : 'media' },
          { responseType: 'arraybuffer' }
        )
        // Google Sheets: export as xlsx first
        let buf: ArrayBuffer
        if (mimeType === 'application/vnd.google-apps.spreadsheet') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const exp = await (drive.files.export as any)(
            { fileId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            { responseType: 'arraybuffer' }
          )
          buf = exp.data as ArrayBuffer
        } else {
          buf = res.data as ArrayBuffer
        }

        const workbook = XLSX.read(Buffer.from(buf))
        const sheets: { name: string; rows: string[][] }[] = workbook.SheetNames.map(sheetName => ({
          name: sheetName,
          rows: XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], { header: 1, defval: '' }),
        }))
        // Convert to tab-separated text (all sheets combined)
        const text = sheets.map(s =>
          `=== ${s.name} ===\n` + s.rows.map(r => r.join('\t')).join('\n')
        ).join('\n\n')
        return Response.json({ connected: true, name, text, format: 'excel', sheets })
      }

      // --- Word (.docx / .doc / Google Docs export) ---
      const isWord =
        mimeType.includes('wordprocessingml') ||
        mimeType.includes('msword') ||
        mimeType === 'application/vnd.google-apps.document'

      if (isWord) {
        let buf: Buffer
        if (mimeType === 'application/vnd.google-apps.document') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const exp = await (drive.files.export as any)(
            { fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
            { responseType: 'arraybuffer' }
          )
          buf = Buffer.from(exp.data as ArrayBuffer)
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await (drive.files.get as any)({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })
          buf = Buffer.from(res.data as ArrayBuffer)
        }
        const result = await mammoth.extractRawText({ buffer: buf })
        return Response.json({ connected: true, name, text: result.value, format: 'word' })
      }

      // --- Plain text / Markdown ---
      let text = ''
      if (mimeType.startsWith('text/') || mimeType.includes('markdown')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (drive.files.get as any)({ fileId, alt: 'media' }, { responseType: 'text' })
        text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      } else {
        return Response.json({ error: 'File type cannot be imported' }, { status: 400 })
      }

      return Response.json({ connected: true, name, text })
    }

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
