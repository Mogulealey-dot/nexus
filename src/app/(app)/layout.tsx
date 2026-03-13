'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useDocs } from '@/hooks/useDocs'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import AppSidebar from '@/components/sidebar/AppSidebar'
import CommandPalette from '@/components/command-palette/CommandPalette'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { tree, docs, createDoc, updateTitle, archiveDoc } = useDocs(user?.id)
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
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CommandPalette docs={docs} onCreateDoc={createDoc} onSignOut={handleSignOut} />
    </div>
  )
}
