'use client'
import { useState, useEffect, useCallback } from 'react'
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
      .select('id, user_id, title, parent_id, icon, is_archived, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
    setDocs((data as DocMeta[]) || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const createDoc = async (parentId?: string) => {
    if (!userId) return null
    const { data } = await supabase
      .from('docs')
      .insert({ user_id: userId, title: 'Untitled', parent_id: parentId || null })
      .select('id')
      .single()
    await fetchDocs()
    return data?.id as string | null
  }

  const updateTitle = async (id: string, title: string) => {
    await supabase.from('docs').update({ title, updated_at: new Date().toISOString() }).eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, title } : d))
  }

  const archiveDoc = async (id: string) => {
    await supabase.from('docs').update({ is_archived: true }).eq('id', id)
    await fetchDocs()
  }

  // Build tree from flat list
  const tree = buildTree(docs)

  return { docs, tree, loading, createDoc, updateTitle, archiveDoc, refetch: fetchDocs }
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
