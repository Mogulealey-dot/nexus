import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

interface EmailPayload {
  id: string
  from: string
  subject: string
  priority: 'HIGH' | 'NORMAL' | 'LOW'
  reason: string
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

  const { emails } = await request.json() as { emails: EmailPayload[] }
  if (!emails?.length) return Response.json({ error: 'No emails provided' }, { status: 400 })

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Map priority to task priority
  const priorityMap: Record<string, 'high' | 'normal' | 'low'> = {
    HIGH: 'high',
    NORMAL: 'normal',
    LOW: 'low',
  }

  const tasks = emails.map(e => ({
    user_id: user.id,
    title: `Reply: ${e.subject} — ${e.from.replace(/<.*>/, '').trim()}`,
    priority: priorityMap[e.priority] ?? 'normal',
    completed: false,
  }))

  const { data, error } = await serviceSupabase
    .from('tasks')
    .insert(tasks)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ created: data.length })
}
