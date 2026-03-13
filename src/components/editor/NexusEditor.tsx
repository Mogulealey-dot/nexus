'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Collaboration from '@tiptap/extension-collaboration'
import { common, createLowlight } from 'lowlight'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, AlignLeft, AlignCenter, AlignRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SlashCommand } from './extensions/SlashCommand'
import { getSupabaseClient } from '@/lib/supabase/client'
import { debounce } from '@/lib/utils'
import type { Editor } from '@tiptap/core'

const lowlight = createLowlight(common)

interface Props {
  docId: string
  initialTitle: string
  userId: string
}

// Floating selection toolbar
function SelectionToolbar({ editor }: { editor: Editor }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const update = () => {
      const { from, to } = editor.state.selection
      if (from === to) { setShow(false); return }
      const sel = window.getSelection()
      if (!sel?.rangeCount) { setShow(false); return }
      const r = sel.getRangeAt(0).getBoundingClientRect()
      if (r.width === 0) { setShow(false); return }
      setRect(r)
      setShow(true)
    }
    editor.on('selectionUpdate', update)
    editor.on('blur', () => setShow(false))
    return () => { editor.off('selectionUpdate', update); editor.off('blur', () => setShow(false)) }
  }, [editor])

  if (!show || !rect) return null

  const top = rect.top + window.scrollY - 48
  const left = rect.left + rect.width / 2

  const buttons = [
    { icon: <Bold size={13} />, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { icon: <Italic size={13} />, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { icon: <UnderlineIcon size={13} />, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline') },
    { icon: <Strikethrough size={13} />, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
    { icon: <Code size={13} />, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
    null,
    { icon: <AlignLeft size={13} />, action: () => editor.chain().focus().setTextAlign('left').run(), active: false },
    { icon: <AlignCenter size={13} />, action: () => editor.chain().focus().setTextAlign('center').run(), active: false },
    { icon: <AlignRight size={13} />, action: () => editor.chain().focus().setTextAlign('right').run(), active: false },
  ]

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 bg-[#1a1a1d] border border-[#2a2a2e] rounded-lg p-1 shadow-2xl -translate-x-1/2"
      style={{ top, left }}
      onMouseDown={e => e.preventDefault()}
    >
      {buttons.map((btn, i) =>
        btn === null
          ? <div key={i} className="w-px h-4 bg-[#2a2a2e] mx-0.5" />
          : <button key={i} onClick={btn.action}
              className={cn('p-1.5 rounded-md transition-colors', btn.active ? 'bg-[#7c6af7] text-white' : 'text-[#a0a0aa] hover:bg-[#2a2a2e] hover:text-white')}
            >{btn.icon}</button>
      )}
    </div>
  )
}

export default function NexusEditor({ docId, initialTitle, userId }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [synced, setSynced] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [ghostText, setGhostText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const ydocRef = useRef<Y.Doc | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const supabase = getSupabaseClient()

  // Init Yjs doc
  useEffect(() => {
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    const persistence = new IndexeddbPersistence(`nexus-doc-${docId}`, ydoc)
    persistence.whenSynced.then(async () => {
      const ytext = ydoc.getText('content')
      if (ytext.length === 0) {
        const { data } = await supabase.from('docs').select('content').eq('id', docId).single()
        if (data?.content) {
          try {
            const bytes = new Uint8Array(Object.values(data.content as Record<string, number>))
            Y.applyUpdate(ydoc, bytes)
          } catch {}
        }
      }
      setSynced(true)
    })

    const syncToCloud = debounce(async () => {
      const update = Y.encodeStateAsUpdate(ydoc)
      await supabase.from('docs').update({ content: Array.from(update), updated_at: new Date().toISOString() }).eq('id', docId)
    }, 1500)
    ydoc.on('update', syncToCloud)

    return () => {
      ydoc.off('update', syncToCloud)
      persistence.destroy()
      ydoc.destroy()
      ydocRef.current = null
      setSynced(false)
    }
  }, [docId, supabase])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Collaboration.configure({ document: ydocRef.current! }),
      Placeholder.configure({ placeholder: "Write something, or press '/' for commands…" }),
      CharacterCount,
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CodeBlockLowlight.configure({ lowlight }),
      SlashCommand,
    ],
    editorProps: {
      attributes: { class: 'tiptap' },
    },
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount?.words?.() ?? 0)
      setGhostText('')
    },
    immediatelyRender: false,
  }, [synced])

  // Save title (debounced)
  const saveTitle = useCallback(debounce(async (t: string) => {
    await supabase.from('docs').update({ title: t, updated_at: new Date().toISOString() }).eq('id', docId)
  }, 800), [docId, supabase])

  const handleTitleChange = (t: string) => { setTitle(t); saveTitle(t) }

  // AI Ghost Writer
  const triggerAI = useCallback(async () => {
    if (!editor || isGenerating) return
    const text = editor.getText()
    const lastParagraph = text.split('\n').filter(Boolean).pop() || ''
    if (lastParagraph.length < 5) return

    setIsGenerating(true)
    setGhostText('')
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const resp = await fetch('/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: lastParagraph, context: text.slice(-500) }),
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
        setGhostText(accumulated)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setGhostText('')
    } finally {
      setIsGenerating(false)
    }
  }, [editor, isGenerating])

  const acceptGhost = useCallback(() => {
    if (!ghostText || !editor) return
    editor.chain().focus().insertContent(' ' + ghostText).run()
    setGhostText('')
  }, [ghostText, editor])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && ghostText) { e.preventDefault(); acceptGhost() }
      if (e.key === 'Escape' && ghostText) setGhostText('')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ghostText, acceptGhost])

  if (!synced || !editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-[#7c6af7] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="relative max-w-3xl mx-auto px-8 py-12">
      <SelectionToolbar editor={editor} />

      {/* Title */}
      <input
        className="w-full text-4xl font-bold bg-transparent border-none outline-none text-[#e8e8ed] placeholder-[#3a3a3f] mb-8 tracking-tight"
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        placeholder="Untitled"
      />

      <EditorContent editor={editor} />

      {/* Ghost text */}
      {ghostText && (
        <div className="mt-1 text-[#4a4a55] italic text-base leading-7 select-none">
          {ghostText}
          <span className="ml-2 text-xs text-[#3a3a3f] not-italic font-medium">Tab to accept · Esc to dismiss</span>
        </div>
      )}

      {/* Footer bar */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3">
        <div className="text-xs text-[#4a4a55]">{wordCount} words</div>
        <div className={cn('w-1.5 h-1.5 rounded-full', synced ? 'bg-[#34c972]' : 'bg-[#f5a623]')} title={synced ? 'Synced' : 'Syncing…'} />
        <button
          onClick={triggerAI}
          disabled={isGenerating}
          className="flex items-center gap-1.5 text-xs bg-[#1a1a1d] border border-[#2a2a2e] text-[#7c6af7] px-3 py-1.5 rounded-full hover:bg-[#2a2a2e] transition-colors disabled:opacity-50"
        >
          <Sparkles size={12} />
          {isGenerating ? 'Writing…' : 'AI Complete'}
        </button>
      </div>
    </div>
  )
}
