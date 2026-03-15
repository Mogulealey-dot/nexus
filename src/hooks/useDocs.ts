'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { DocMeta } from '@/types'

export function useDocs(userId: string | undefined) {
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [archivedDocs, setArchivedDocs] = useState<DocMeta[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  const fetchDocs = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data, error } = await supabase
      .from('docs')
      .select('id, user_id, title, parent_id, icon, is_archived, is_starred, tags, position, is_public, public_slug, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
    if (error) {
      // Fallback: query only base columns (some optional columns may not exist yet)
      console.warn('Full docs query failed, falling back to base columns:', error.message)
      const { data: baseData } = await supabase
        .from('docs')
        .select('id, user_id, title, parent_id, icon, is_archived, created_at, updated_at')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: true })
      setDocs(((baseData || []).map((d: Record<string, unknown>) => ({
        ...d,
        is_starred: false,
        tags: [],
        position: null,
        is_public: false,
        public_slug: null,
      })) as DocMeta[]))
    } else {
      setDocs((data as DocMeta[]) || [])
    }
    setLoading(false)
  }, [userId, supabase])

  const fetchArchived = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('docs')
      .select('id, user_id, title, parent_id, icon, is_archived, is_starred, tags, position, is_public, public_slug, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_archived', true)
      .order('updated_at', { ascending: false })
    if (error) {
      const { data: baseData } = await supabase
        .from('docs')
        .select('id, user_id, title, parent_id, icon, is_archived, created_at, updated_at')
        .eq('user_id', userId)
        .eq('is_archived', true)
        .order('updated_at', { ascending: false })
      setArchivedDocs(((baseData || []).map((d: Record<string, unknown>) => ({
        ...d, is_starred: false, tags: [], position: null, is_public: false, public_slug: null,
      })) as DocMeta[]))
    } else {
      setArchivedDocs((data as DocMeta[]) || [])
    }
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

  const updateIcon = useCallback(async (id: string, icon: string | null) => {
    await supabase.from('docs').update({ icon }).eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, icon } : d))
    window.dispatchEvent(new CustomEvent('nexus:docs-updated'))
  }, [supabase])

  const archiveDoc = useCallback(async (id: string) => {
    await supabase.from('docs').update({ is_archived: true }).eq('id', id)
    await fetchDocs()
    await fetchArchived()
  }, [supabase, fetchDocs, fetchArchived])

  const restoreDoc = useCallback(async (id: string) => {
    await supabase.from('docs').update({ is_archived: false }).eq('id', id)
    await fetchDocs()
    setArchivedDocs(prev => prev.filter(d => d.id !== id))
  }, [supabase, fetchDocs])

  const deleteDoc = useCallback(async (id: string) => {
    await supabase.from('docs').delete().eq('id', id)
    setArchivedDocs(prev => prev.filter(d => d.id !== id))
  }, [supabase])

  const duplicateDoc = useCallback(async (id: string) => {
    if (!userId) return null
    const source = docs.find(d => d.id === id)
    if (!source) return null
    const { data: sourceData } = await supabase
      .from('docs')
      .select('content, text_content')
      .eq('id', id)
      .single()
    const { data: newDoc } = await supabase
      .from('docs')
      .insert({
        user_id: userId,
        title: `${source.title || 'Untitled'} (copy)`,
        parent_id: source.parent_id || null,
        icon: source.icon,
        content: sourceData?.content || null,
        text_content: (sourceData as Record<string, unknown>)?.text_content || null,
      })
      .select('id')
      .single()
    await fetchDocs()
    return newDoc?.id as string | null
  }, [userId, supabase, docs, fetchDocs])

  const toggleStar = useCallback(async (id: string) => {
    const doc = docs.find(d => d.id === id)
    if (!doc) return
    const next = !doc.is_starred
    await supabase.from('docs').update({ is_starred: next }).eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, is_starred: next } : d))
  }, [docs, supabase])

  const searchDocs = useCallback(async (query: string): Promise<DocMeta[]> => {
    if (!userId || !query.trim()) return []
    const safe = query.replace(/[,()]/g, '').trim()
    if (!safe) return []
    const [keywordRes, semanticRes] = await Promise.allSettled([
      supabase
        .from('docs')
        .select('id, user_id, title, parent_id, icon, is_archived, is_starred, tags, position, is_public, public_slug, created_at, updated_at')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .or(`title.ilike.%${safe}%,text_content.ilike.%${safe}%`)
        .limit(10),
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
    if (keywordRes.status === 'fulfilled' && keywordRes.value.data) {
      for (const d of keywordRes.value.data as DocMeta[]) {
        keywordIds.add(d.id)
        results.push(d)
      }
    }
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

  const reorderDoc = useCallback(async (id: string, newPosition: number) => {
    await supabase.from('docs').update({ position: newPosition }).eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, position: newPosition } : d))
  }, [supabase])

  const togglePublic = useCallback(async (id: string): Promise<string | null> => {
    const doc = docs.find(d => d.id === id)
    if (!doc) return null
    if (!doc.is_public) {
      const slug = `${id.slice(0, 8)}-${Date.now().toString(36)}`
      await supabase.from('docs').update({ is_public: true, public_slug: slug }).eq('id', id)
      setDocs(prev => prev.map(d => d.id === id ? { ...d, is_public: true, public_slug: slug } : d))
      return slug
    } else {
      await supabase.from('docs').update({ is_public: false, public_slug: null }).eq('id', id)
      setDocs(prev => prev.map(d => d.id === id ? { ...d, is_public: false, public_slug: null } : d))
      return null
    }
  }, [docs, supabase])

  const sortedDocs = useMemo(() => {
    return [...docs].sort((a, b) => {
      const ap = a.position ?? null
      const bp = b.position ?? null
      if (ap !== null && bp !== null) return ap - bp
      if (ap !== null) return -1
      if (bp !== null) return 1
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [docs])

  const tree = useMemo(() => buildTree(sortedDocs), [sortedDocs])
  const starred = useMemo(() => docs.filter(d => d.is_starred), [docs])
  const recent = useMemo(
    () => [...docs].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 8),
    [docs]
  )

  return {
    docs, tree, starred, recent, archivedDocs, loading,
    createDoc, updateTitle, updateIcon, archiveDoc, restoreDoc, deleteDoc,
    duplicateDoc, toggleStar, searchDocs, refetch: fetchDocs, fetchArchived,
    reorderDoc, togglePublic,
  }
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
