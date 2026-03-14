'use client'
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getSupabaseClient } from '@/lib/supabase/client'
import { debounce } from '@/lib/utils'

export function useYDoc(docId: string | null) {
  const ydocRef = useRef<Y.Doc | null>(null)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    if (!docId) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    // 1. Local persistence via IndexedDB
    const persistence = new IndexeddbPersistence(`nexus-doc-${docId}`, ydoc)
    persistence.on('synced', () => setSynced(true))

    // 2. Load from Supabase if IndexedDB is empty
    const supabase = getSupabaseClient()
    persistence.whenSynced.then(async () => {
      const ytext = ydoc.getText('content')
      if (ytext.length === 0) {
        const { data } = await supabase.from('docs').select('content').eq('id', docId).single()
        if (data?.content) {
          try {
            const bytes = new Uint8Array(Object.values(data.content as Record<string, number>))
            Y.applyUpdate(ydoc, bytes)
          } catch {}
        }
      }
      setSynced(true)
    })

    // 3. Sync back to Supabase on change (debounced)
    const syncToCloud = debounce(async () => {
      const update = Y.encodeStateAsUpdate(ydoc)
      await supabase.from('docs').update({ content: Array.from(update), updated_at: new Date().toISOString() }).eq('id', docId)
    }, 1500)

    ydoc.on('update', syncToCloud)

    return () => {
      syncToCloud.cancel() // prevent a pending debounced write from firing after unmount
      ydoc.off('update', syncToCloud)
      persistence.destroy()
      ydoc.destroy()
      ydocRef.current = null
      setSynced(false)
    }
  }, [docId])

  return { ydoc: ydocRef.current, synced }
}
