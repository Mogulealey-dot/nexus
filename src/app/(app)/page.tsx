'use client'
export const dynamic = 'force-dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDocs } from '@/hooks/useDocs'
import { useAuth } from '@/hooks/useAuth'
import { Sparkles, FileText, Plus } from 'lucide-react'

export default function HomePage() {
  const { user } = useAuth()
  const { docs, tree, createDoc } = useDocs(user?.id)
  const router = useRouter()

  // Auto-navigate to first doc if one exists
  useEffect(() => {
    if (docs.length > 0) router.replace(`/docs/${docs[0].id}`)
  }, [docs, router])

  const handleCreate = async () => {
    const id = await createDoc()
    if (id) router.push(`/docs/${id}`)
  }

  return (
    <div className="flex items-center justify-center h-screen text-center px-8">
      <div>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7c6af7]/20 to-[#9080ff]/10 border border-[#7c6af7]/20 flex items-center justify-center mx-auto mb-6">
          <Sparkles size={28} className="text-[#7c6af7]" />
        </div>
        <h1 className="text-2xl font-bold text-[#e8e8ed] mb-2">Welcome to Nexus</h1>
        <p className="text-[#6b6b75] text-sm mb-8 max-w-sm mx-auto">
          Your local-first, AI-native workspace. Press <kbd className="bg-[#1a1a1d] border border-[#2a2a2e] px-1.5 py-0.5 rounded text-xs">⌘K</kbd> to search or create a page.
        </p>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 bg-[#7c6af7] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#9080ff] transition-colors"
        >
          <Plus size={16} /> Create your first page
        </button>
      </div>
    </div>
  )
}
