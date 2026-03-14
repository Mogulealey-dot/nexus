'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { DocMeta } from '@/types'

export function useDocs(userId: string | undefined) {
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  const fetchDocs = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('docs')
      .select('id, user_id, title, parent_id, icon, is_archived, is_starred, tags, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
    setDocs((data as DocMeta[]) || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const createDoc = useCallback(async (parentId?: string) => {
    if (!userId) return null
    const { data } = await supabase
      .from('docs')
      .insert({ user_id: userId, title: 'Untitled', parent_id: parentId || null })
      .select('id')
      .single()
    await fetchDocs()
    return data?.id as string | null
  }, [userId, supabase, fetchDocs])

  const updateTitle = useCallback(async (id: string, title: string) => {
    await supabase.from('docs').update({ title, updated_at: new Date().toISOString() }).eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, title } : d))
  }, [supabase])

  const archiveDoc = useCallback(async (id: string) => {
    await supabase.from('docs').update({ is_archived: true }).eq('id', id)
    await fetchDocs()
  }, [supabase, fetchDocs])

  const toggleStar = useCallback(async (id: string) => {
    const doc = docs.find(d => d.id === id)
    if (!doc) return
    const next = !doc.is_starred
    await supabase.from('docs').update({ is_starred: next }).eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, is_starred: next } : d))
  }, [docs, supabase])

  const searchDocs = useCallback(async (query: string): Promise<DocMeta[]> => {
    if (!userId || !query.trim()) return []

    // Sanitize query to prevent PostgREST filter injection — commas and parens
    // can break the .or() filter syntax and expose unintended rows
    const safe = query.replace(/[,()]/g, '').trim()
    if (!safe) return []

    // Run keyword search and semantic search in parallel
    const [keywordRes, semanticRes] = await Promise.allSettled([
      // Keyword search (sanitized)
      supabase
        .from('docs')
        .select('id, user_id, title, parent_id, icon, is_archived, is_starred, tags, created_at, updated_at')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .or(`title.ilike.%${safe}%,text_content.ilike.%${safe}%`)
        .limit(10),

      // Semantic search — generate embedding then query match_docs RPC
      (async () => {
        const resp = await fetch('/api/ai/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: safe }),
        })
        const { embedding } = await resp.json()
        if (!embedding) return { data: [] }
        return supabase.rpc('match_docs', {
          query_embedding: embedding,
          match_threshold: 0.25,
          match_count: 10,
          p_user_id: userId,
        })
      })(),
    ])

    const keywordIds = new Set<string>()
    const results: DocMeta[] = []

    // Add keyword results first
    if (keywordRes.status === 'fulfilled' && keywordRes.value.data) {
      for (const d of keywordRes.value.data as DocMeta[]) {
        keywordIds.add(d.id)
        results.push(d)
      }
    }

    // Add semantic results that weren't already found by keyword search
    if (semanticRes.status === 'fulfilled') {
      const semanticData = (semanticRes.value as { data: { id: string }[] | null }).data || []
      for (const row of semanticData) {
        if (!keywordIds.has(row.id)) {
          const doc = docs.find(d => d.id === row.id)
          if (doc) results.push(doc)
        }
      }
    }

    return results.slice(0, 15)
  }, [userId, supabase, docs])

  // Memoize derived lists so they don't recompute on every render
  const tree = useMemo(() => buildTree(docs), [docs])
  const starred = useMemo(() => docs.filter(d => d.is_starred), [docs])
  const recent = useMemo(
    () => [...docs].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 8),
    [docs]
  )

  return { docs, tree, starred, recent, loading, createDoc, updateTitle, archiveDoc, toggleStar, searchDocs, refetch: fetchDocs }
}

function buildTree(docs: DocMeta[]): DocMeta[] {
  const map = new Map<string, DocMeta>()
  const roots: DocMeta[] = []
  docs.forEach(d => map.set(d.id, { ...d, children: [] }))
  docs.forEach(d => {
    const node = map.get(d.id)!
    if (d.parent_id && map.has(d.parent_id)) {
      map.get(d.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}
