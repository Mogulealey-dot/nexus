'use client'
import { useState } from 'react'
import { HardDriveDownload, Loader2 } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

export default function BackupButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)
  const supabase = getSupabaseClient()

  const backup = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('docs')
        .select('id, title, text_content, parent_id, icon, tags, is_starred, created_at, updated_at')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: true })

      const payload = {
        app: 'Nexus',
        exported_at: new Date().toISOString(),
        note_count: data?.length ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notes: (data || []).map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          content: doc.text_content || '',
          parent_id: doc.parent_id,
          icon: doc.icon,
          tags: doc.tags,
          is_starred: doc.is_starred,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
        })),
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `nexus-backup-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={backup}
      disabled={loading}
      title="Download a backup of all your notes"
      className="flex items-center gap-1.5 text-[10px] text-[#4a4a55] hover:text-[#6b6b75] transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <HardDriveDownload size={11} />}
      {loading ? 'Backing up…' : 'Backup notes'}
    </button>
  )
}
