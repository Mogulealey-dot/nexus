'use client'
import { useState } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Plus, LogOut, Keyboard, PanelLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/appStore'
import type { DocMeta } from '@/types'

interface Props {
  docs: DocMeta[]
  onCreateDoc: () => Promise<string | null>
  onSignOut: () => void
}

const SHORTCUTS = [
  { key: '⌘K', label: 'Open command palette' },
  { key: '/', label: 'Slash commands in editor' },
  { key: 'Tab', label: 'Accept AI completion' },
  { key: 'Esc', label: 'Dismiss AI / close palette' },
  { key: '⌘B', label: 'Bold selected text' },
  { key: '⌘I', label: 'Italic selected text' },
]

export default function CommandPalette({ docs, onCreateDoc, onSignOut }: Props) {
  const router = useRouter()
  const { commandPaletteOpen, setCommandPaletteOpen, toggleSidebar } = useAppStore()
  const [query, setQuery] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)

  const handleSelect = (action: () => void) => {
    action()
    setCommandPaletteOpen(false)
    setQuery('')
    setShowShortcuts(false)
  }

  const filteredDocs = query.trim()
    ? docs.filter(d => d.title.toLowerCase().includes(query.toLowerCase()))
    : docs.slice(0, 8)

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => { setCommandPaletteOpen(false); setQuery(''); setShowShortcuts(false) }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="fixed top-[18%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl"
          >
            <Command
              className="bg-[#141416] border border-[#2a2a2e] rounded-2xl shadow-2xl overflow-hidden"
              shouldFilter={false}
            >
              <div className="flex items-center gap-3 px-4 border-b border-[#1e1e22]">
                <span className="text-[#6b6b75] text-sm">⌘</span>
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search pages, run actions…"
                  className="flex-1 bg-transparent py-4 text-sm text-[#e8e8ed] outline-none placeholder-[#4a4a55]"
                  autoFocus
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-xs text-[#4a4a55] hover:text-[#6b6b75]">clear</button>
                )}
              </div>

              <Command.List className="max-h-[400px] overflow-y-auto py-2">
                <Command.Empty className="py-8 text-center text-sm text-[#4a4a55]">
                  No results for &quot;{query}&quot;
                </Command.Empty>

                {/* Actions */}
                {!query && (
                  <Command.Group heading="Actions" className="px-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-[#3a3a3f] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
                    <Command.Item
                      onSelect={() => handleSelect(async () => { const id = await onCreateDoc(); if (id) router.push(`/docs/${id}`) })}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                    >
                      <Plus size={14} className="text-[#7c6af7]" />
                      <span className="flex-1">New Page</span>
                      <kbd className="text-[10px] text-[#3a3a3f] bg-[#1e1e22] px-1.5 py-0.5 rounded">⌘N</kbd>
                    </Command.Item>
                    <Command.Item
                      onSelect={() => handleSelect(toggleSidebar)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                    >
                      <PanelLeft size={14} className="text-[#6b6b75]" />
                      <span className="flex-1">Toggle Sidebar</span>
                      <kbd className="text-[10px] text-[#3a3a3f] bg-[#1e1e22] px-1.5 py-0.5 rounded">⌘\</kbd>
                    </Command.Item>
                    <Command.Item
                      onSelect={() => setShowShortcuts(s => !s)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                    >
                      <Keyboard size={14} className="text-[#6b6b75]" />
                      <span className="flex-1">Keyboard Shortcuts</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() => handleSelect(onSignOut)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                    >
                      <LogOut size={14} className="text-[#6b6b75]" />
                      Sign Out
                    </Command.Item>
                  </Command.Group>
                )}

                {/* Shortcuts panel */}
                {showShortcuts && !query && (
                  <div className="mx-2 mb-2 bg-[#0d0d0f] rounded-xl p-3 border border-[#1e1e22]">
                    <div className="text-[10px] text-[#3a3a3f] font-semibold uppercase tracking-wider mb-2 px-1">Shortcuts</div>
                    {SHORTCUTS.map(s => (
                      <div key={s.key} className="flex items-center justify-between px-1 py-1">
                        <span className="text-xs text-[#6b6b75]">{s.label}</span>
                        <kbd className="text-[10px] text-[#a0a0aa] bg-[#1e1e22] border border-[#2a2a2e] px-1.5 py-0.5 rounded">{s.key}</kbd>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pages */}
                <Command.Group heading={query ? `Pages matching "${query}"` : 'Recent Pages'} className="px-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-[#3a3a3f] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
                  {filteredDocs.length === 0 && query ? null : filteredDocs.map(doc => (
                    <Command.Item
                      key={doc.id}
                      value={doc.title}
                      onSelect={() => handleSelect(() => router.push(`/docs/${doc.id}`))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                    >
                      <FileText size={14} className="text-[#6b6b75] flex-shrink-0" />
                      <span className="flex-1 truncate">{doc.title || 'Untitled'}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>

              {/* Footer */}
              <div className="border-t border-[#1e1e22] px-4 py-2 flex items-center gap-4 text-[10px] text-[#3a3a3f]">
                <span><kbd className="bg-[#1e1e22] px-1 rounded">↑↓</kbd> navigate</span>
                <span><kbd className="bg-[#1e1e22] px-1 rounded">↵</kbd> select</span>
                <span><kbd className="bg-[#1e1e22] px-1 rounded">Esc</kbd> close</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
