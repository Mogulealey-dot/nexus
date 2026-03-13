'use client'
import { useEffect, useRef } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Plus, Search, Sparkles, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/appStore'
import type { DocMeta } from '@/types'

interface Props {
  docs: DocMeta[]
  onCreateDoc: () => Promise<string | null>
  onSignOut: () => void
}

export default function CommandPalette({ docs, onCreateDoc, onSignOut }: Props) {
  const router = useRouter()
  const { commandPaletteOpen, setCommandPaletteOpen } = useAppStore()

  const handleSelect = (action: () => void) => {
    action()
    setCommandPaletteOpen(false)
  }

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setCommandPaletteOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.12 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl"
          >
            <Command
              className="bg-[#141416] border border-[#2a2a2e] rounded-2xl shadow-2xl overflow-hidden"
              shouldFilter={false}
            >
              <div className="flex items-center gap-3 px-4 border-b border-[#1e1e22]">
                <Search size={16} className="text-[#6b6b75]" />
                <Command.Input
                  placeholder="Search pages, run actions…"
                  className="flex-1 bg-transparent py-4 text-sm text-[#e8e8ed] outline-none placeholder-[#4a4a55]"
                  autoFocus
                />
              </div>
              <Command.List className="max-h-96 overflow-y-auto py-2">
                <Command.Empty className="py-8 text-center text-sm text-[#4a4a55]">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Actions" className="px-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-[#4a4a55] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
                  <Command.Item
                    onSelect={() => handleSelect(async () => { const id = await onCreateDoc(); if (id) router.push(`/docs/${id}`) })}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                  >
                    <Plus size={15} className="text-[#7c6af7]" />
                    New Page
                    <kbd className="ml-auto text-[10px] text-[#4a4a55]">⌘N</kbd>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelect(onSignOut)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                  >
                    <LogOut size={15} className="text-[#6b6b75]" />
                    Sign Out
                  </Command.Item>
                </Command.Group>

                {docs.length > 0 && (
                  <Command.Group heading="Pages" className="px-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-[#4a4a55] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
                    {docs.slice(0, 12).map(doc => (
                      <Command.Item
                        key={doc.id}
                        value={doc.title}
                        onSelect={() => handleSelect(() => router.push(`/docs/${doc.id}`))}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-[#a0a0aa] data-[selected=true]:bg-[#7c6af7]/15 data-[selected=true]:text-[#e8e8ed] transition-colors"
                      >
                        <FileText size={14} className="text-[#6b6b75] flex-shrink-0" />
                        <span className="truncate">{doc.title || 'Untitled'}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
