'use client'
import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const SHORTCUTS = [
  { group: 'Navigation', items: [
    { keys: ['⌘', 'K'], desc: 'Open command palette' },
    { keys: ['?'], desc: 'Show this shortcuts overlay' },
  ]},
  { group: 'Editor', items: [
    { keys: ['/'], desc: 'Slash commands (insert blocks)' },
    { keys: ['@'], desc: 'Link to another page' },
    { keys: ['Tab'], desc: 'Accept AI ghost text' },
    { keys: ['Esc'], desc: 'Dismiss AI ghost text' },
    { keys: ['⌘', 'B'], desc: 'Bold' },
    { keys: ['⌘', 'I'], desc: 'Italic' },
    { keys: ['⌘', 'U'], desc: 'Underline' },
    { keys: ['⌘', 'Shift', 'S'], desc: 'Strikethrough' },
    { keys: ['⌘', '`'], desc: 'Inline code' },
  ]},
  { group: 'AI', items: [
    { keys: ['AI Complete'], desc: 'Ghost-write from current paragraph' },
    { keys: ['Summarize'], desc: 'Summarize the current note' },
    { keys: ['Ask Nexus AI'], desc: 'Open the AI chat panel' },
  ]},
  { group: 'View', items: [
    { keys: ['Read Mode'], desc: 'Toggle distraction-free reading' },
    { keys: ['History'], desc: 'View version history panel' },
  ]},
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function ShortcutsModal({ open, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-[#0d0d0f] border border-[#2a2a2e] rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e22]">
              <div className="flex items-center gap-2">
                <Keyboard size={15} className="text-[#7c6af7]" />
                <span className="text-sm font-semibold text-[#e8e8ed]">Keyboard Shortcuts</span>
              </div>
              <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md text-[#4a4a55] hover:text-[#6b6b75] hover:bg-[#1e1e22] transition-colors">
                <X size={13} />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-5">
              {SHORTCUTS.map(group => (
                <div key={group.group}>
                  <div className="text-[10px] text-[#3a3a3f] font-semibold uppercase tracking-wider mb-2">{group.group}</div>
                  <div className="space-y-1">
                    {group.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-xs text-[#8a8a94]">{item.desc}</span>
                        <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                          {item.keys.map((k, j) => (
                            <kbd key={j} className="text-[11px] bg-[#1a1a1d] border border-[#2a2a2e] text-[#a0a0aa] px-2 py-0.5 rounded-md font-mono">{k}</kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-[#1e1e22] text-[10px] text-[#3a3a3f] text-center">
              Press <kbd className="bg-[#1a1a1d] border border-[#2a2a2e] text-[#6b6b75] px-1.5 py-0.5 rounded text-[10px]">?</kbd> anywhere to open this overlay
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
