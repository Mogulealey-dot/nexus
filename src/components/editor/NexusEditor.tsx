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
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, AlignLeft, AlignCenter, AlignRight, Sparkles, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SlashCommand } from './extensions/SlashCommand'
import { getSupabaseClient } from '@/lib/supabase/client'
import { debounce } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { TEMPLATES } from '@/lib/templates'
import type { Editor } from '@tiptap/core'

const lowlight = createLowlight(common)

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
    const hide = () => setShow(false)
    editor.on('selectionUpdate', update)
    editor.on('blur', hide)
    return () => { editor.off('selectionUpdate', update); editor.off('blur', hide) }
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

// Inner editor — only mounts when ydoc is ready
function EditorInner({ docId, initialTitle, ydoc }: { docId: string; initialTitle: string; ydoc: Y.Doc }) {
  const [title, setTitle] = useState(initialTitle)
  const [wordCount, setWordCount] = useState(0)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [ghostText, setGhostText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const templateApplied = useRef(false)
  const supabase = getSupabaseClient()
  const { pendingTemplate, setPendingTemplate } = useAppStore()
  const readTime = Math.max(1, Math.ceil(wordCount / 200))

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Collaboration.configure({ document: ydoc }),
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
    editorProps: { attributes: { class: 'tiptap' } },
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount?.words?.() ?? 0)
      setGhostText('')
    },
    immediatelyRender: false,
  })

  // Apply pending template on first load when doc is empty
  useEffect(() => {
    if (!editor || !pendingTemplate || templateApplied.current) return
    const isEmpty = editor.state.doc.textContent.trim().length === 0
    if (!isEmpty) return
    const template = TEMPLATES.find(t => t.id === pendingTemplate)
    if (template) {
      editor.commands.setContent(template.content)
      if (template.name !== 'Untitled') {
        setTitle(template.name)
        saveTitle(template.name)
      }
    }
    templateApplied.current = true
    setPendingTemplate(null)
  }, [editor, pendingTemplate]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTitle = async (t: string) => {
    setSaveStatus('saving')
    await supabase.from('docs').update({ title: t || 'Untitled', updated_at: new Date().toISOString() }).eq('id', docId)
    setSaveStatus('saved')
  }

  const handleTitleChange = (t: string) => { setTitle(t); setSaveStatus('unsaved') }

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

  if (!editor) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-[#7c6af7] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  )

  return (
    <div className="relative max-w-3xl mx-auto px-8 py-12">
      <SelectionToolbar editor={editor} />
      <input
        className="w-full text-4xl font-bold bg-transparent border-none outline-none text-[#e8e8ed] placeholder-[#3a3a3f] mb-8 tracking-tight"
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        onBlur={e => saveTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveTitle(title); (e.target as HTMLInputElement).blur() } }}
        placeholder="Untitled"
      />
      <EditorContent editor={editor} />
      {ghostText && (
        <div className="mt-1 text-[#4a4a55] italic text-base leading-7 select-none">
          {ghostText}
          <span className="ml-2 text-xs text-[#3a3a3f] not-italic font-medium">Tab to accept · Esc to dismiss</span>
        </div>
      )}
      <div className="fixed bottom-6 right-6 flex items-center gap-3">
        <button
          onClick={() => {
            const html = editor.getHTML()
            // Simple HTML→Markdown conversion via blob download
            const md = html
              .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
              .replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
              .replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
              .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
              .replace(/<em>(.*?)<\/em>/g, '*$1*')
              .replace(/<code>(.*?)<\/code>/g, '`$1`')
              .replace(/<li><p>(.*?)<\/p><\/li>/g, '- $1\n')
              .replace(/<li>(.*?)<\/li>/g, '- $1\n')
              .replace(/<p>(.*?)<\/p>/g, '$1\n')
              .replace(/<br\s*\/?>/g, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
              .trim()
            const blob = new Blob([`# ${title}\n\n${md}`], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `${title || 'untitled'}.md`; a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-1.5 text-xs bg-[#1a1a1d] border border-[#2a2a2e] text-[#6b6b75] px-3 py-1.5 rounded-full hover:bg-[#2a2a2e] hover:text-[#a0a0aa] transition-colors"
          title="Export as Markdown"
        >
          <Download size={12} />
          Export
        </button>
        <div className="text-xs text-[#4a4a55]">{wordCount} words · {readTime} min read</div>
        <div className={cn(
          'flex items-center gap-1.5 text-xs transition-colors',
          saveStatus === 'saved' ? 'text-[#34c972]' : saveStatus === 'saving' ? 'text-[#f5a623]' : 'text-[#4a4a55]'
        )}>
          <div className={cn('w-1.5 h-1.5 rounded-full', saveStatus === 'saving' && 'animate-pulse', saveStatus === 'saved' ? 'bg-[#34c972]' : saveStatus === 'saving' ? 'bg-[#f5a623]' : 'bg-[#4a4a55]')} />
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'}
        </div>
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

// Outer wrapper — handles Yjs lifecycle, only renders EditorInner once ydoc is ready
export default function NexusEditor({ docId, initialTitle }: { docId: string; initialTitle: string; userId: string }) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const doc = new Y.Doc()
    const persistence = new IndexeddbPersistence(`nexus-doc-${docId}`, doc)

    const syncToCloud = debounce(async () => {
      const update = Y.encodeStateAsUpdate(doc)
      await supabase.from('docs').update({ content: Array.from(update), updated_at: new Date().toISOString() }).eq('id', docId)
    }, 1500)

    persistence.whenSynced.then(async () => {
      const ytext = doc.getText('content')
      if (ytext.length === 0) {
        const { data } = await supabase.from('docs').select('content').eq('id', docId).single()
        if (data?.content) {
          try {
            const bytes = new Uint8Array(Object.values(data.content as Record<string, number>))
            Y.applyUpdate(doc, bytes)
          } catch {}
        }
      }
      doc.on('update', syncToCloud)
      setYdoc(doc)
    })

    return () => {
      doc.off('update', syncToCloud)
      persistence.destroy()
      doc.destroy()
      setYdoc(null)
    }
  }, [docId, supabase])

  if (!ydoc) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-[#7c6af7] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  )

  return <EditorInner docId={docId} initialTitle={initialTitle} ydoc={ydoc} />
}
