// Public read-only share page — no auth required (RLS policy allows is_public=true docs)
//
// SQL to run in Supabase SQL Editor:
// alter table docs add column if not exists is_public boolean default false;
// alter table docs add column if not exists public_slug text;
// create unique index if not exists docs_public_slug_idx on docs(public_slug) where public_slug is not null;
// create policy "Public docs are readable by anyone" on docs for select using (is_public = true);

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase
    .from('docs')
    .select('title, content, text_content')
    .eq('public_slug', slug)
    .eq('is_public', true)
    .single()

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-[#e8e8ed] mb-2">Note not found</h1>
          <p className="text-sm text-[#6b6b75]">This note may have been made private or the link is invalid.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f]">
      {/* Header */}
      <header className="border-b border-[#1e1e22] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#7c6af7] to-[#9080ff] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">N</span>
          </div>
          <span className="text-sm font-semibold text-[#e8e8ed]">Nexus</span>
          <span className="text-[#3a3a3f] text-sm mx-1">/</span>
          <span className="text-xs text-[#6b6b75]">Shared note</span>
        </div>
        <span className="text-xs bg-[#34c972]/10 text-[#34c972] border border-[#34c972]/20 px-2 py-0.5 rounded-full">
          Public
        </span>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-8 py-12">
        <h1 className="text-4xl font-bold text-[#e8e8ed] mb-8 tracking-tight">{data.title || 'Untitled'}</h1>
        {data.text_content ? (
          <div className="text-[#a0a0aa] leading-relaxed whitespace-pre-wrap text-base">{data.text_content}</div>
        ) : (
          <div className="text-[#4a4a55] italic text-sm">This note has no content.</div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e22] px-6 py-4 text-center">
        <p className="text-xs text-[#3a3a3f]">
          Shared via{' '}
          <a href="https://nexus.app" className="text-[#7c6af7] hover:text-[#9080ff]">Nexus</a>
          {' '}— AI-native note-taking
        </p>
      </footer>
    </div>
  )
}
