import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import * as Y from 'yjs'

function xmlEl(tag: string, attrs: Record<string, string | number> = {}) {
  const el = new Y.XmlElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

function xmlText(str: string) {
  const t = new Y.XmlText()
  if (str) t.insert(0, str)
  return t
}

function para(text: string) {
  const p = xmlEl('paragraph')
  if (text) p.push([xmlText(text)])
  return p
}

function heading(text: string, level = 1) {
  const h = xmlEl('heading', { level })
  h.push([xmlText(text)])
  return h
}

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

  const { title, text, source, icon } = await request.json() as {
    title: string
    text: string
    source?: string  // e.g. 'Google Docs', 'Google Sheets', 'Google Drive'
    icon?: string
  }

  if (!title) return Response.json({ error: 'Title required' }, { status: 400 })

  // Build Yjs doc from plain text
  const doc = new Y.Doc()
  const frag = doc.getXmlFragment('default')

  frag.push([heading(title, 1)])

  if (source) {
    frag.push([para(`Imported from ${source} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`)])
    frag.push([para('')])
  }

  // Split text into paragraphs (preserve blank lines as separators)
  const lines = (text || '').split('\n')
  for (const line of lines) {
    frag.push([para(line)])
  }

  const update = Array.from(Y.encodeStateAsUpdate(doc))

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await serviceSupabase
    .from('docs')
    .insert({
      user_id: user.id,
      title,
      content: update,
      text_content: text?.slice(0, 500),
      icon: icon || '📄',
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ docId: data.id })
}
