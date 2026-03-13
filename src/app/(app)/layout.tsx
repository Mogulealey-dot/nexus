'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useDocs } from '@/hooks/useDocs'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import AppSidebar from '@/components/sidebar/AppSidebar'
import CommandPalette from '@/components/command-palette/CommandPalette'
import { WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { tree, docs, createDoc, updateTitle, archiveDoc, toggleStar, searchDocs } = useDocs(user?.id)
  const isOnline = useOnlineStatus()
  useCommandPalette()

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

  return (
    <div className="flex h-screen bg-[#0d0d0f] overflow-hidden">
      <AppSidebar
        user={user}
        tree={tree}
        onSignOut={handleSignOut}
        onCreateDoc={createDoc}
        onArchiveDoc={archiveDoc}
        onRenameDoc={updateTitle}
        onToggleStar={toggleStar}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CommandPalette docs={docs} onCreateDoc={createDoc} onSignOut={handleSignOut} onSearch={searchDocs} />

      {/* Offline banner */}
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
