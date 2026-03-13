'use client'
import { useState, useEffect, useRef } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Plus, LogOut, Keyboard, PanelLeft, LayoutTemplate, ChevronLeft, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/appStore'
import { TEMPLATES } from '@/lib/templates'
import type { DocMeta } from '@/types'

interface Props {
  docs: DocMeta[]
  onCreateDoc: () => Promise<string | null>
  onSignOut: () => void
  onSearch: (q: string) => Promise<DocMeta[]>
}

const SHORTCUTS = [
  { key: '⌘K', label: 'Open command palette' },
  { key: '/', label: 'Slash commands in editor' },
  { key: 'Tab', label: 'Accept AI completion' },
  { key: 'Esc', label: 'Dismiss AI / close palette' },
  { key: '⌘B', label: 'Bold selected text' },
  { key: '⌘I', label: 'Italic selected text' },
]

type View = 'main' | 'templates' | 'shortcuts'

export default function CommandPalette({ docs, onCreateDoc, onSignOut, onSearch }: Props) {
  const router = useRouter()
  const { commandPaletteOpen, setCommandPaletteOpen, toggleSidebar, setPendingTemplate } = useAppStore()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('main')
  const [searchResults, setSearchResults] = useState<DocMeta[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Full-text search with debounce
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!query.trim()) { setSearchResults([]); setIsSearching(false); return }
    setIsSearching(true)
    searchTimer.current = setTimeout(async () => {
      const results = await onSearch(query)
      setSearchResults(results)
      setIsSearching(false)
    }, 250)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, onSearch])

  const close = () => {
    setCommandPaletteOpen(false)
    setQuery('')
    setView('main')
    setSearchResults([])
  }

  const handleSelect = (action: () => void) => {
    action()
    close()
  }

  const displayDocs = query.trim() ? searchResults : docs.slice(0, 8)

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={close}
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
              {/* Input row */}
              <div className="flex items-center gap-3 px-4 border-b border-[#1e1e22]">
                {view !== 'main' ? (
                  <button onClick={() => { setView('main'); setQuery('') }} className="text-[#6b6b75] hover:text-[#a0a0aa] transition-colors">
                    <ChevronLeft size={15} />
                  </button>
                ) : (
                  <span className="text-[#6b6b75] text-sm">⌘</span>
                )}
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder={
                    view === 'templates' ? 'Search templates…' :
                    view === 'shortcuts' ? 'Keyboard shortcuts' :
                    'Search pages, run actions…'
                  }
                  className="flex-1 bg-transparent py-4 text-sm text-[#e8e8ed] outline-none placeholder-[#4a4a55]"
                  autoFocus
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-xs text-[#4a4a55] hover:text-[#6b6b75]">clear</button>
                )}
              </div>

              <Command.List className="max-h-[420px] overflow-y-auto py-2">
                <Command.Empty className="py-8 text-center text-sm text-[#4a4a55]">
                  No results for &quot;{query}&quot;
                </Command.Empty>

                {/* Shortcuts panel */}
                {view === 'shortcuts' && (
                  <div className="mx-2 mb-2 bg-[#0d0d0f] rounded-xl p-3 border border-[#1e1e22]">
                    <div className="text-[10px] text-[#3a3a3f] font-semibold uppercase tracking-wider mb-2 px-1">Keyboard Shortcuts</div>
                    {SHORTCUTS.map(s => (
                      <div key={s.key} className="flex items-center justify-between px-1 py-1.5">
                        <span className="text-xs text-[#6b6b75]">{s.label}</span>
                        <kbd className="text-[10px] text-[#a0a0aa] bg-[#1e1e22] border border-[#2a2a2e] px-1.5 py-0.5 rounded">{s.key}</kbd>
                      </div>
                    ))}
                  </div>
                )}

                {/* Templates panel */}
                {view === 'templates' && (
                  <Command.Group heading="Choose a template" className="px-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-[#3a3a3f] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
                    {TEMPLATES.filter(t => !query || t.name.toLowerCase().includes(query.toLowerCase())).map(t => (
                      <Command.Item
                        key={t.id}
                        onSelect={() => handleSelect(async () => {
                          setPendingTemplate(t.id)
                          const id = await onCreateDoc()
                          if (id) router.push(`/docs/${id}`)
                        })}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                      >
                        <span className="text-base w-5 text-center">{t.icon}</span>
                        <div className="flex-1">
                          <div className="text-sm text-[#e8e8ed]">{t.name}</div>
                          <div className="text-xs text-[#4a4a55]">{t.description}</div>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Main view */}
                {view === 'main' && !query && (
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
                      onSelect={() => setView('templates')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                    >
                      <LayoutTemplate size={14} className="text-[#6b6b75]" />
                      <span className="flex-1">New from Template</span>
                      <span className="text-[10px] text-[#3a3a3f]">{TEMPLATES.length} templates</span>
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
                      onSelect={() => setView('shortcuts')}
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

                {/* Pages */}
                {view === 'main' && (
                  <Command.Group
                    heading={query ? `Search results ${isSearching ? '…' : `(${displayDocs.length})`}` : 'Recent Pages'}
                    className="px-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-[#3a3a3f] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                  >
                    {isSearching && (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#4a4a55]">
                        <Search size={12} className="animate-pulse" /> Searching…
                      </div>
                    )}
                    {!isSearching && displayDocs.length === 0 && query ? null : displayDocs.map(doc => (
                      <Command.Item
                        key={doc.id}
                        value={doc.title}
                        onSelect={() => handleSelect(() => router.push(`/docs/${doc.id}`))}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                      >
                        <FileText size={14} className="text-[#6b6b75] flex-shrink-0" />
                        <span className="flex-1 truncate">{doc.title || 'Untitled'}</span>
                        {doc.is_starred && <span className="text-[#f5a623] text-xs">★</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer */}
              <div className="border-t border-[#1e1e22] px-4 py-2 flex items-center gap-4 text-[10px] text-[#3a3a3f]">
                <span><kbd className="bg-[#1e1e22] px-1 rounded">↑↓</kbd> navigate</span>
                <span><kbd className="bg-[#1e1e22] px-1 rounded">↵</kbd> select</span>
                <span><kbd className="bg-[#1e1e22] px-1 rounded">Esc</kbd> close</span>
                {view !== 'main' && (
                  <span><kbd className="bg-[#1e1e22] px-1 rounded">←</kbd> back</span>
                )}
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
