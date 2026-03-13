'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles, RotateCcw, Bot } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import type { DocMeta } from '@/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  docs: DocMeta[]
  currentPageTitle?: string
}

const QUICK_PROMPTS = [
  'Summarize my recent notes',
  'What are my starred pages about?',
  'Help me brainstorm ideas',
  'What have I been working on?',
]

function buildNotesContext(docs: DocMeta[]): string {
  const lines: string[] = []
  const withContent = docs.filter(d => (d as DocMeta & { text_content?: string }).text_content)
  const subset = withContent.slice(0, 10)
  for (const doc of subset) {
    const text = (doc as DocMeta & { text_content?: string }).text_content || ''
    lines.push(`Page: "${doc.title}"\n${text.slice(0, 400)}`)
  }
  if (lines.length === 0) {
    // Fall back to just titles
    docs.slice(0, 20).forEach(d => lines.push(`Page: "${d.title}"`))
  }
  return lines.join('\n\n')
}

export default function AIChatPanel({ docs, currentPageTitle }: Props) {
  const { chatOpen, setChatOpen } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 200)
  }, [chatOpen])

  const sendMessage = async (text: string) => {
    const content = text.trim()
    if (!content || isStreaming) return

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          notesContext: buildNotesContext(docs),
          currentPageTitle,
        }),
        signal: abortRef.current.signal,
      })

      const reader = resp.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: accumulated }
          return updated
        })
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setIsStreaming(false)
  }

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setChatOpen(false)}
          />

          <motion.aside
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="fixed right-0 top-0 h-screen w-[360px] bg-[#0d0d0f] border-l border-[#1e1e22] flex flex-col z-50 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1e1e22]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7c6af7] to-[#9080ff] flex items-center justify-center">
                  <Sparkles size={13} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#e8e8ed]">Nexus AI</div>
                  <div className="text-[10px] text-[#4a4a55]">
                    {docs.length > 0 ? `Aware of ${docs.length} page${docs.length !== 1 ? 's' : ''}` : 'No pages yet'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4a4a55] hover:text-[#6b6b75] hover:bg-[#1e1e22] transition-colors"
                    title="Clear chat"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
                <button
                  onClick={() => setChatOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4a4a55] hover:text-[#6b6b75] hover:bg-[#1e1e22] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#1a1a1d] border border-[#2a2a2e] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot size={13} className="text-[#7c6af7]" />
                    </div>
                    <div className="bg-[#141416] border border-[#1e1e22] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-[#a0a0aa] leading-relaxed">
                      Hi! I'm Nexus AI. I can search your notes, summarize pages, help you write, or answer questions. What can I help with?
                    </div>
                  </div>

                  {/* Quick prompts */}
                  <div className="space-y-2 mt-2">
                    {QUICK_PROMPTS.map(p => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        className="w-full text-left px-3 py-2.5 rounded-xl border border-[#1e1e22] text-xs text-[#6b6b75] hover:border-[#7c6af7]/30 hover:text-[#a0a0aa] hover:bg-[#141416] transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={cn('flex items-start gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold',
                      msg.role === 'user'
                        ? 'bg-[#7c6af7] text-white'
                        : 'bg-[#1a1a1d] border border-[#2a2a2e] text-[#7c6af7]'
                    )}>
                      {msg.role === 'user' ? 'Y' : <Bot size={13} />}
                    </div>
                    <div className={cn(
                      'max-w-[80%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-[#7c6af7]/15 border border-[#7c6af7]/20 rounded-2xl rounded-tr-sm text-[#e8e8ed]'
                        : 'bg-[#141416] border border-[#1e1e22] rounded-2xl rounded-tl-sm text-[#a0a0aa]'
                    )}>
                      {msg.content}
                      {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
                        <span className="inline-block w-1.5 h-4 bg-[#7c6af7] ml-0.5 animate-pulse rounded-sm align-middle" />
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-[#1e1e22]">
              {currentPageTitle && (
                <div className="text-[10px] text-[#3a3a3f] mb-2 truncate">
                  Context: <span className="text-[#4a4a55]">{currentPageTitle}</span>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your notes…"
                  rows={1}
                  className="flex-1 bg-[#141416] border border-[#2a2a2e] rounded-xl px-3 py-2.5 text-sm text-[#e8e8ed] placeholder-[#3a3a3f] outline-none focus:border-[#7c6af7]/50 transition-colors resize-none max-h-32 leading-relaxed"
                  style={{ height: 'auto', minHeight: '42px' }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement
                    t.style.height = 'auto'
                    t.style.height = `${Math.min(t.scrollHeight, 128)}px`
                  }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isStreaming}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#7c6af7] text-white hover:bg-[#9080ff] transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
              <div className="text-[10px] text-[#3a3a3f] mt-1.5 text-center">
                Enter to send · Shift+Enter for new line
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
