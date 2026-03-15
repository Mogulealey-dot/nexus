'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useDocs } from '@/hooks/useDocs'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAppStore } from '@/store/appStore'
import AppSidebar from '@/components/sidebar/AppSidebar'
import CommandPalette from '@/components/command-palette/CommandPalette'
import AIChatPanel from '@/components/ai/AIChatPanel'
import ShortcutsModal from '@/components/ShortcutsModal'
import { WifiOff, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const {
    tree, docs, archivedDocs,
    createDoc, updateTitle, archiveDoc, restoreDoc, deleteDoc,
    duplicateDoc, toggleStar, searchDocs, refetch, fetchArchived,
  } = useDocs(user?.id)
  const isOnline = useOnlineStatus()
  const { chatOpen, toggleChat, shortcutsOpen, setShortcutsOpen, toggleShortcuts } = useAppStore()
  useCommandPalette()

  // Listen for doc updates from editor (e.g. icon changes) and refresh
  useEffect(() => {
    const handler = () => refetch()
    window.addEventListener('nexus:docs-updated', handler)
    return () => window.removeEventListener('nexus:docs-updated', handler)
  }, [refetch])

  // Global `?` key opens shortcuts overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      if (e.key === '?') toggleShortcuts()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleShortcuts])

  useEffect(() => {
    if (user === null) router.replace('/login')
  }, [user, router])

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-[#7c6af7] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </div>
    )
  }

  const handleSignOut = async () => { await signOut(); router.replace('/login') }

  const currentDocId = pathname?.split('/docs/')?.[1] || null
  const currentPageTitle = currentDocId ? docs.find(d => d.id === currentDocId)?.title : undefined

  return (
    <div className="flex h-screen bg-[#0d0d0f] overflow-hidden">
      <AppSidebar
        user={user}
        tree={tree}
        archivedDocs={archivedDocs}
        onSignOut={handleSignOut}
        onCreateDoc={createDoc}
        onArchiveDoc={archiveDoc}
        onRestoreDoc={restoreDoc}
        onDeleteDoc={deleteDoc}
        onRenameDoc={updateTitle}
        onToggleStar={toggleStar}
        onDuplicateDoc={duplicateDoc}
        onFetchArchived={fetchArchived}
      />

      <main className="flex-1 overflow-y-auto">{children}</main>

      <AIChatPanel docs={docs} currentPageTitle={currentPageTitle} />

      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={toggleChat}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#7c6af7] hover:bg-[#9080ff] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg shadow-[#7c6af7]/25 transition-colors"
          >
            <Sparkles size={13} />
            Ask Nexus AI
          </motion.button>
        )}
      </AnimatePresence>

      <CommandPalette docs={docs} onCreateDoc={createDoc} onSignOut={handleSignOut} onSearch={searchDocs} />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-[#1a1a1d] border border-[#f5a623]/30 text-[#f5a623] text-xs px-4 py-2.5 rounded-full shadow-2xl"
          >
            <WifiOff size={13} />
            You're offline — changes are saved locally and will sync when reconnected
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
