'use client'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Plus, ChevronLeft, Sparkles, Star } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/appStore'
import DocTreeItem from './DocTreeItem'
import type { DocMeta } from '@/types'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User
  tree: DocMeta[]
  onSignOut: () => void
  onCreateDoc: (parentId?: string) => Promise<string | null>
  onArchiveDoc: (id: string) => Promise<void>
  onRenameDoc: (id: string, title: string) => Promise<void>
  onToggleStar: (id: string) => Promise<void>
}

export default function AppSidebar({ user, tree, onSignOut, onCreateDoc, onArchiveDoc, onRenameDoc, onToggleStar }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar, setCommandPaletteOpen } = useAppStore()
  const activeDocId = pathname?.split('/docs/')?.[1] || null

  const handleCreate = async (parentId?: string) => {
    const id = await onCreateDoc(parentId)
    if (id) router.push(`/docs/${id}`)
  }

  const handleNavigate = (id: string) => router.push(`/docs/${id}`)

  // Flatten tree to find starred docs
  const allDocs: DocMeta[] = []
  const flatten = (nodes: DocMeta[]) => nodes.forEach(n => { allDocs.push(n); if (n.children) flatten(n.children) })
  flatten(tree)
  const starred = allDocs.filter(d => d.is_starred)

  const treeItemProps = {
    activeDocId,
    onNavigate: handleNavigate,
    onCreateChild: handleCreate,
    onArchive: onArchiveDoc,
    onRename: onRenameDoc,
    onToggleStar,
  }

  return (
    <>
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={toggleSidebar}
            className="fixed top-4 left-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1a1d] border border-[#2a2a2e] text-[#6b6b75] hover:text-[#e8e8ed] hover:bg-[#2a2a2e] transition-colors"
          >
            <ChevronLeft size={14} className="rotate-180" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="fixed md:relative z-50 md:z-auto h-screen w-[260px] bg-[#0d0d0f] border-r border-[#1e1e22] flex flex-col overflow-hidden flex-shrink-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#7c6af7] to-[#9080ff] flex items-center justify-center">
                  <Sparkles size={12} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-[#e8e8ed]">Nexus</span>
              </div>
              <button onClick={toggleSidebar} className="w-6 h-6 flex items-center justify-center rounded-md text-[#6b6b75] hover:bg-[#1e1e22] hover:text-[#e8e8ed] transition-colors">
                <ChevronLeft size={14} />
              </button>
            </div>

            {/* Search */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141416] border border-[#1e1e22] text-[#6b6b75] text-sm hover:border-[#2a2a2e] hover:text-[#a0a0aa] transition-colors"
            >
              <Search size={13} />
              <span className="flex-1 text-left text-xs">Search…</span>
              <kbd className="text-xs bg-[#1e1e22] px-1.5 py-0.5 rounded text-[#4a4a55]">⌘K</kbd>
            </button>

            {/* New doc */}
            <button
              onClick={() => handleCreate()}
              className="mx-3 mb-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[#7c6af7] text-sm hover:bg-[#7c6af7]/10 transition-colors"
            >
              <Plus size={14} />
              New Page
            </button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">

              {/* Starred section */}
              {starred.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[#3a3a3f] font-semibold uppercase tracking-wider">
                    <Star size={9} className="text-[#f5a623]" />
                    Starred
                  </div>
                  {starred.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => handleNavigate(doc.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
                        activeDocId === doc.id ? 'bg-[#7c6af7]/15 text-[#e8e8ed]' : 'text-[#8a8a94] hover:bg-[#1e1e22] hover:text-[#e8e8ed]'
                      }`}
                    >
                      <span className="flex-1 truncate">{doc.title || 'Untitled'}</span>
                    </div>
                  ))}
                  <div className="h-px bg-[#1e1e22] mx-2 my-2" />
                </div>
              )}

              {/* All pages tree */}
              <div className="text-[10px] text-[#3a3a3f] font-semibold uppercase tracking-wider px-2 py-1">Pages</div>
              {tree.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-[#4a4a55]">No pages yet.</p>
                  <button onClick={() => handleCreate()} className="mt-2 text-xs text-[#7c6af7] hover:text-[#9080ff]">Create your first page →</button>
                </div>
              ) : tree.map(doc => (
                <DocTreeItem key={doc.id} doc={doc} depth={0} {...treeItemProps} />
              ))}
            </div>

            {/* User */}
            <div className="border-t border-[#1e1e22] px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#34c972] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {user.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#e8e8ed] truncate">{user.user_metadata?.full_name || user.email}</div>
                  <div className="text-[10px] text-[#4a4a55] truncate">{user.email}</div>
                </div>
                <button onClick={onSignOut} className="text-[10px] text-[#4a4a55] hover:text-[#6b6b75] transition-colors">Sign out</button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
