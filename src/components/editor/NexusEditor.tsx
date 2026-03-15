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
import Image from '@tiptap/extension-image'
import Mathematics from '@tiptap/extension-mathematics'
import { common, createLowlight } from 'lowlight'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, AlignLeft, AlignCenter, AlignRight, Sparkles, Download, ImagePlus, Mic, MicOff, FileText, X, Copy, ChevronsDown, History, RotateCcw, Tag, Plus, BookOpen, Edit3, BarChart2, Link2, List, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SlashCommand } from './extensions/SlashCommand'
import { getSupabaseClient } from '@/lib/supabase/client'
import { debounce } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { TEMPLATES } from '@/lib/templates'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import type { Editor } from '@tiptap/core'
import { updatePagesList } from './extensions/PageLinkExtension'
import { PageLinkExtension } from './extensions/PageLinkExtension'
import type { DocMeta } from '@/types'
import { usePresence } from '@/hooks/usePresence'
import PresenceAvatars from './PresenceAvatars'
import 'katex/dist/katex.min.css'

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

const ICON_PICKER_EMOJIS = ['📄','📝','📌','⭐','🔥','💡','📊','🎯','🚀','💼','🎓','🔧','🌟','❤️','🎨','🔍','📚','💰','🌿','⚡','🏠','🎵','✅','🧠','🔬']

interface TOCHeading {
  level: number
  text: string
}

// Inner editor — only mounts when ydoc is ready
function EditorInner({ docId, initialTitle, initialTags, initialIcon, initialIsPublic, initialPublicSlug, ydoc, onUpdateIcon, onTogglePublic, docs }: {
  docId: string
  initialTitle: string
  initialTags: string[]
  initialIcon?: string | null
  initialIsPublic?: boolean
  initialPublicSlug?: string | null
  ydoc: Y.Doc
  onUpdateIcon?: (icon: string | null) => void
  onTogglePublic?: () => Promise<string | null>
  docs?: DocMeta[]
}) {
  const [title, setTitle] = useState(initialTitle)
  const [wordCount, setWordCount] = useState(0)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [ghostText, setGhostText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [summary, setSummary] = useState('')
  const [isSummarizing, setIsSummarizing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const templateApplied = useRef(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const supabase = getSupabaseClient()
  const { pendingTemplate, setPendingTemplate, pendingImport, setPendingImport } = useAppStore()
  const readTime = Math.max(1, Math.ceil(wordCount / 200))

  const [tags, setTags] = useState<string[]>(initialTags)
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [versions, setVersions] = useState<{ id: string; created_at: string; content_html: string }[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isReadMode, setIsReadMode] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [docIcon, setDocIcon] = useState<string | null>(initialIcon || null)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const lastSnapshotRef = useRef<number>(0)
  const saveVersionRef = useRef<() => void>(() => {})

  // Feature 11 — AI Auto-tag
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [isAutoTagging, setIsAutoTagging] = useState(false)

  // Feature 12 — Related Notes
  const [showRelated, setShowRelated] = useState(false)
  const [relatedDocs, setRelatedDocs] = useState<DocMeta[]>([])
  const [isLoadingRelated, setIsLoadingRelated] = useState(false)

  // Feature 13 — Public Share
  const [isPublic, setIsPublic] = useState(initialIsPublic || false)
  const [publicSlug, setPublicSlug] = useState<string | null>(initialPublicSlug || null)
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Feature 15 — TOC
  const [showTOC, setShowTOC] = useState(false)
  const [tocHeadings, setTocHeadings] = useState<TOCHeading[]>([])

  const handleVoiceTranscript = useCallback((text: string) => {
    if (!editorRef.current) return
    editorRef.current.chain().focus().insertContent(' ' + text + ' ').run()
  }, [])

  const { isRecording, interimText, isSupported: isSpeechSupported, toggle: toggleRecording } = useSpeechRecognition(handleVoiceTranscript)

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()
    const path = `${docId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('doc-images').upload(path, file, { upsert: true })
    if (error) { console.error('Image upload failed:', error.message); return null }
    const { data } = supabase.storage.from('doc-images').getPublicUrl(path)
    return data.publicUrl
  }, [docId, supabase])

  const editorRef = useRef<Editor | null>(null)

  const insertImage = useCallback(async (file: File) => {
    const ed = editorRef.current
    if (!ed) return
    setIsUploadingImage(true)
    const url = await uploadImage(file)
    setIsUploadingImage(false)
    if (url) {
      ed.chain().focus().setImage({ src: url, alt: file.name }).run()
    } else {
      alert('Image upload failed — check that the doc-images bucket exists in Supabase Storage and has upload permissions.')
    }
  }, [uploadImage])

  // Extract TOC headings from editor HTML
  const extractTOC = useCallback((editor: Editor) => {
    const html = editor.getHTML()
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const headings: TOCHeading[] = []
    doc.querySelectorAll('h1, h2, h3').forEach(el => {
      const level = parseInt(el.tagName[1])
      const text = el.textContent?.trim() || ''
      if (text) headings.push({ level, text })
    })
    setTocHeadings(headings)
  }, [])

  const mermaidInitialized = useRef(false)
  const mermaidDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runMermaid = useCallback(() => {
    if (mermaidDebounceRef.current) clearTimeout(mermaidDebounceRef.current)
    mermaidDebounceRef.current = setTimeout(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        if (!mermaidInitialized.current) {
          mermaid.initialize({ startOnLoad: false, theme: 'dark' })
          mermaidInitialized.current = true
        }
        await mermaid.run({ querySelector: '.language-mermaid' })
      } catch {
        // mermaid rendering errors are non-fatal
      }
    }, 500)
  }, [])

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
      Image.configure({ inline: false, allowBase64: false }),
      Mathematics,
      SlashCommand,
      PageLinkExtension,
    ],
    editorProps: {
      attributes: { class: 'tiptap' },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        files.forEach(f => insertImage(f))
        return true
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter(f => f.type.startsWith('image/'))
        if (!files.length) return false
        files.forEach(f => insertImage(f))
        return true
      },
    },
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount?.words?.() ?? 0)
      setCharCount(editor.storage.characterCount?.characters?.() ?? 0)
      setGhostText('')
      saveVersionRef.current()
      if (showTOC) extractTOC(editor)
      runMermaid()
    },
    immediatelyRender: false,
  })

  // Keep editorRef in sync
  useEffect(() => { editorRef.current = editor }, [editor])

  // Run mermaid on mount
  useEffect(() => {
    if (editor) runMermaid()
  }, [editor, runMermaid])

  // Extract TOC when showTOC toggled on
  useEffect(() => {
    if (showTOC && editor) extractTOC(editor)
  }, [showTOC, editor, extractTOC])

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

  // Feature 14 — Apply pending import
  useEffect(() => {
    if (!editor || !pendingImport || pendingImport.docId !== docId) return
    editor.commands.setContent(pendingImport.html)
    setTitle(pendingImport.title)
    saveTitle(pendingImport.title)
    setPendingImport(null)
  }, [editor, pendingImport, docId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const summarizeDoc = useCallback(async () => {
    if (!editor || isSummarizing) return
    const text = editor.getText().trim()
    if (text.length < 50) return

    setIsSummarizing(true)
    setSummary('')

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Please summarize the following note concisely. Give a 2-3 sentence overview, then 3-5 key bullet points.\n\nTitle: ${title}\n\n${text.slice(0, 3000)}` }],
          currentPageTitle: title,
        }),
      })
      const reader = resp.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setSummary(accumulated)
      }
    } catch {
      setSummary('')
    } finally {
      setIsSummarizing(false)
    }
  }, [editor, isSummarizing, title])

  // Feature 11 — AI Auto-tag
  const handleAutoTag = useCallback(async () => {
    if (!editor || isAutoTagging) return
    setIsAutoTagging(true)
    setSuggestedTags([])
    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Suggest 3-5 concise lowercase tags for this note. Reply with ONLY a comma-separated list of tags, nothing else.\n\nTitle: ${title}\n\n${editor.getText().slice(0, 1000)}`,
          }],
          currentPageTitle: title,
        }),
      })
      const reader = resp.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }
      const parsed = accumulated.split(',').map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean)
      setSuggestedTags(parsed.filter(t => !tags.includes(t)))
    } catch {
      // silently fail
    } finally {
      setIsAutoTagging(false)
    }
  }, [editor, isAutoTagging, title, tags])

  // Feature 12 — Related Notes
  const handleRelated = useCallback(async () => {
    if (!editor || isLoadingRelated) return
    setShowRelated(v => !v)
    if (showRelated) return
    setIsLoadingRelated(true)
    setRelatedDocs([])
    try {
      const text = editor.getText().trim().slice(0, 512)
      if (text.length < 20) { setIsLoadingRelated(false); return }
      const resp = await fetch('/api/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const { embedding } = await resp.json()
      if (!embedding) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.rpc('match_docs', {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 8,
        p_user_id: user.id,
      })
      if (data) {
        const filtered = (data as { id: string }[])
          .filter((r) => r.id !== docId)
          .map((r) => docs?.find(d => d.id === r.id))
          .filter((d): d is DocMeta => d !== undefined)
          .slice(0, 6)
        setRelatedDocs(filtered)
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingRelated(false)
    }
  }, [editor, isLoadingRelated, showRelated, supabase, docId, docs])

  // Feature 13 — Public Share
  const handleTogglePublic = useCallback(async () => {
    if (!onTogglePublic || isToggling) return
    setIsToggling(true)
    try {
      const slug = await onTogglePublic()
      setIsPublic(!!slug)
      setPublicSlug(slug)
    } finally {
      setIsToggling(false)
    }
  }, [onTogglePublic, isToggling])

  const publicUrl = publicSlug ? `https://mogul-notes.com/share/${publicSlug}` : null

  const addTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed || tags.includes(trimmed)) return
    const next = [...tags, trimmed]
    setTags(next)
    await supabase.from('docs').update({ tags: next }).eq('id', docId)
  }

  const removeTag = async (tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    await supabase.from('docs').update({ tags: next }).eq('id', docId)
  }

  const saveVersion = useCallback(async () => {
    const ed = editorRef.current
    if (!ed) return
    const now = Date.now()
    if (now - lastSnapshotRef.current < 5 * 60 * 1000) return // throttle to 5 min
    const text = ed.getText().trim()
    if (text.length < 30) return
    lastSnapshotRef.current = now
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('doc_versions').insert({
        doc_id: docId,
        user_id: user.id,
        content_html: ed.getHTML(),
        text_content: text,
      })
    } catch {} // silently skip if table doesn't exist yet
  }, [docId, supabase])

  // Keep saveVersionRef pointing at the latest saveVersion
  useEffect(() => { saveVersionRef.current = saveVersion }, [saveVersion])

  // Sync editor editability with read mode
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!isReadMode)
  }, [editor, isReadMode])

  const handleSetIcon = async (emoji: string | null) => {
    setDocIcon(emoji)
    setShowIconPicker(false)
    if (onUpdateIcon) onUpdateIcon(emoji)
  }

  const paragraphCount = editor ? (editor.getHTML().match(/<p/g) || []).length : 0

  const loadVersions = async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('doc_versions')
      .select('id, created_at, content_html')
      .eq('doc_id', docId)
      .order('created_at', { ascending: false })
      .limit(20)
    setVersions((data || []) as { id: string; created_at: string; content_html: string }[])
    setHistoryLoading(false)
  }

  const restoreVersion = (html: string) => {
    if (!editor) return
    editor.commands.setContent(html)
    setShowHistory(false)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && ghostText) { e.preventDefault(); acceptGhost() }
      if (e.key === 'Escape' && ghostText) setGhostText('')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ghostText, acceptGhost])

  // Scroll to heading in TOC
  const scrollToHeading = (text: string) => {
    const editorEl = document.querySelector('.tiptap')
    if (!editorEl) return
    const headings = editorEl.querySelectorAll('h1, h2, h3')
    for (const h of headings) {
      if (h.textContent?.trim() === text) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      }
    }
  }

  if (!editor) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-[#7c6af7] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  )

  return (
    <div className="relative max-w-3xl mx-auto px-8 py-12">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) insertImage(f); e.target.value = '' }}
      />
      <SelectionToolbar editor={editor} />

      {/* Icon picker */}
      <div className="relative mb-3">
        <button
          onClick={() => setShowIconPicker(v => !v)}
          className="text-3xl hover:bg-[#1e1e22] rounded-lg p-1 transition-colors"
          title="Set page icon"
        >
          {docIcon || '📄'}
        </button>
        {showIconPicker && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a1d] border border-[#2a2a2e] rounded-xl shadow-2xl p-3 w-52">
            <div className="grid grid-cols-5 gap-1 mb-2">
              {ICON_PICKER_EMOJIS.map(e => (
                <button key={e} onClick={() => handleSetIcon(e)}
                  className={cn('text-xl p-1.5 rounded-lg hover:bg-[#2a2a2e] transition-colors', docIcon === e && 'bg-[#7c6af7]/20')}
                >{e}</button>
              ))}
            </div>
            <button onClick={() => handleSetIcon(null)}
              className="w-full text-xs text-[#4a4a55] hover:text-[#6b6b75] py-1 border-t border-[#2a2a2e] mt-1 transition-colors"
            >Remove icon</button>
          </div>
        )}
      </div>

      <input
        className={cn(
          'w-full text-4xl font-bold bg-transparent border-none outline-none text-[#e8e8ed] placeholder-[#3a3a3f] mb-8 tracking-tight',
          isReadMode && 'pointer-events-none'
        )}
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        onBlur={e => saveTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveTitle(title); (e.target as HTMLInputElement).blur() } }}
        placeholder="Untitled"
        readOnly={isReadMode}
      />

      {/* Tags */}
      <div className="flex items-center flex-wrap gap-1.5 mb-6 -mt-4">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 text-[11px] bg-[#7c6af7]/10 text-[#7c6af7] border border-[#7c6af7]/20 px-2 py-0.5 rounded-full">
            #{tag}
            <button onClick={() => removeTag(tag)} className="text-[#7c6af7]/60 hover:text-[#7c6af7] ml-0.5">
              <X size={9} />
            </button>
          </span>
        ))}

        {/* Feature 11 — Suggested tags */}
        {suggestedTags.map(tag => (
          <span
            key={`sug-${tag}`}
            className="flex items-center gap-1 text-[11px] bg-[#34c972]/10 text-[#34c972] border border-[#34c972]/20 px-2 py-0.5 rounded-full cursor-pointer hover:bg-[#34c972]/20 transition-colors"
            title="Click to add tag"
            onClick={() => { addTag(tag); setSuggestedTags(prev => prev.filter(t => t !== tag)) }}
          >
            +{tag}
            <button
              onClick={e => { e.stopPropagation(); setSuggestedTags(prev => prev.filter(t => t !== tag)) }}
              className="text-[#34c972]/60 hover:text-[#34c972] ml-0.5"
            >
              <X size={9} />
            </button>
          </span>
        ))}

        {showTagInput ? (
          <input
            autoFocus
            className="text-[11px] bg-[#141416] border border-[#7c6af7]/30 text-[#e8e8ed] px-2 py-0.5 rounded-full outline-none w-28 placeholder-[#4a4a55]"
            placeholder="Add tag…"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { addTag(tagInput); setTagInput(''); setShowTagInput(false) }
              if (e.key === 'Escape') { setTagInput(''); setShowTagInput(false) }
              if (e.key === ',' || e.key === ' ') { e.preventDefault(); addTag(tagInput); setTagInput('') }
            }}
            onBlur={() => { if (tagInput) addTag(tagInput); setTagInput(''); setShowTagInput(false) }}
          />
        ) : (
          <button
            onClick={() => setShowTagInput(true)}
            className="flex items-center gap-1 text-[11px] text-[#3a3a3f] hover:text-[#6b6b75] transition-colors"
          >
            <Plus size={10} /> tag
          </button>
        )}
        <button
          onClick={handleAutoTag}
          disabled={isAutoTagging}
          className="flex items-center gap-1 text-[11px] text-[#7c6af7]/60 hover:text-[#7c6af7] transition-colors disabled:opacity-50"
          title="AI auto-suggest tags"
        >
          <Sparkles size={10} />
          {isAutoTagging ? 'Tagging…' : 'Auto-tag'}
        </button>
      </div>

      {/* Summary card */}
      {(summary || isSummarizing) && (
        <div className="mb-6 bg-[#141416] border border-[#7c6af7]/25 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e22]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#7c6af7] to-[#9080ff] flex items-center justify-center">
                <Sparkles size={11} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-[#a0a0aa]">AI Summary</span>
              {isSummarizing && <span className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] animate-pulse" />}
            </div>
            <div className="flex items-center gap-1">
              {summary && (
                <>
                  <button
                    onClick={() => navigator.clipboard.writeText(summary)}
                    className="flex items-center gap-1 text-[10px] text-[#4a4a55] hover:text-[#a0a0aa] px-2 py-1 rounded-lg hover:bg-[#1e1e22] transition-colors"
                    title="Copy summary"
                  >
                    <Copy size={11} /> Copy
                  </button>
                  <button
                    onClick={() => {
                      editor.chain().focus().insertContentAt(0, `<blockquote><strong>Summary:</strong> ${summary}</blockquote><p></p>`).run()
                      setSummary('')
                    }}
                    className="flex items-center gap-1 text-[10px] text-[#7c6af7] hover:text-[#9080ff] px-2 py-1 rounded-lg hover:bg-[#7c6af7]/10 transition-colors"
                    title="Insert at top of doc"
                  >
                    <ChevronsDown size={11} /> Insert
                  </button>
                </>
              )}
              <button
                onClick={() => setSummary('')}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-[#3a3a3f] hover:text-[#6b6b75] hover:bg-[#1e1e22] transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="px-4 py-3 text-sm text-[#a0a0aa] leading-relaxed whitespace-pre-wrap">
            {summary || <span className="text-[#4a4a55] italic">Generating summary…</span>}
            {isSummarizing && summary && <span className="inline-block w-1.5 h-4 bg-[#7c6af7] ml-0.5 animate-pulse rounded-sm align-middle" />}
          </div>
        </div>
      )}

      {isReadMode && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-[#7c6af7]/10 border border-[#7c6af7]/20 rounded-lg">
          <BookOpen size={13} className="text-[#7c6af7]" />
          <span className="text-xs text-[#7c6af7]">Reading mode — editing disabled</span>
          <button onClick={() => setIsReadMode(false)} className="ml-auto text-xs text-[#7c6af7] hover:text-[#9080ff]">Exit</button>
        </div>
      )}

      {/* Feature 15 — TOC Panel (left-floating) */}
      {showTOC && tocHeadings.length > 0 && (
        <div className="fixed left-[280px] top-20 z-40 w-56 bg-[#0d0d0f] border border-[#1e1e22] rounded-xl shadow-2xl p-3 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#a0a0aa]">Table of Contents</span>
            <button onClick={() => setShowTOC(false)} className="text-[#4a4a55] hover:text-[#6b6b75]"><X size={11} /></button>
          </div>
          <div className="space-y-0.5">
            {tocHeadings.map((h, i) => (
              <button
                key={i}
                onClick={() => scrollToHeading(h.text)}
                className="w-full text-left text-xs text-[#6b6b75] hover:text-[#e8e8ed] hover:bg-[#1e1e22] rounded px-2 py-1 transition-colors truncate"
                style={{ paddingLeft: `${0.5 + (h.level - 1) * 0.75}rem` }}
              >
                {h.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <EditorContent editor={editor} />

      {/* Voice interim transcript preview */}
      {isRecording && (
        <div className="mt-2 flex items-center gap-2 text-sm text-[#6b6b75] italic select-none">
          <span className="w-2 h-2 rounded-full bg-[#f56565] animate-pulse flex-shrink-0" />
          {interimText || 'Listening…'}
        </div>
      )}

      {ghostText && (
        <div className="mt-1 text-[#4a4a55] italic text-base leading-7 select-none">
          {ghostText}
          <span className="ml-2 text-xs text-[#3a3a3f] not-italic font-medium">Tab to accept · Esc to dismiss</span>
        </div>
      )}

      {/* Stats popup */}
      {showStats && (
        <div className="fixed bottom-14 right-6 z-50 bg-[#1a1a1d] border border-[#2a2a2e] rounded-xl shadow-2xl p-4 w-52">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#e8e8ed]">Note Stats</span>
            <button onClick={() => setShowStats(false)} className="text-[#4a4a55] hover:text-[#6b6b75]"><X size={12} /></button>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Words', value: wordCount },
              { label: 'Characters', value: charCount },
              { label: 'Paragraphs', value: paragraphCount },
              { label: 'Read time', value: `${readTime} min` },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-[#6b6b75]">{s.label}</span>
                <span className="text-xs font-semibold text-[#e8e8ed]">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature 13 — Share Panel */}
      {showSharePanel && (
        <div className="fixed bottom-14 right-6 z-50 bg-[#1a1a1d] border border-[#2a2a2e] rounded-xl shadow-2xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#e8e8ed]">Share Note</span>
            <button onClick={() => setShowSharePanel(false)} className="text-[#4a4a55] hover:text-[#6b6b75]"><X size={12} /></button>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-[#a0a0aa]">{isPublic ? 'Public — anyone with the link can view' : 'Private — only you can see this'}</p>
            </div>
            <button
              onClick={handleTogglePublic}
              disabled={isToggling}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                isPublic ? 'bg-[#34c972]' : 'bg-[#2a2a2e]',
                isToggling && 'opacity-50'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                isPublic ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
          {isPublic && publicUrl && (
            <div className="space-y-2">
              <input
                readOnly
                value={publicUrl}
                className="w-full text-xs bg-[#141416] border border-[#2a2a2e] text-[#a0a0aa] px-2 py-1.5 rounded-lg outline-none"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl)
                  setCopySuccess(true)
                  setTimeout(() => setCopySuccess(false), 2000)
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs bg-[#7c6af7] hover:bg-[#9080ff] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <Copy size={11} />
                {copySuccess ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-6 right-6 flex items-center gap-3 flex-wrap justify-end max-w-[calc(100vw-2rem)]">
        {/* Feature 15 — TOC button */}
        <button
          onClick={() => setShowTOC(v => !v)}
          className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
            showTOC ? 'bg-[#7c6af7]/10 border-[#7c6af7]/30 text-[#7c6af7]' : 'bg-[#1a1a1d] border-[#2a2a2e] text-[#4a4a55] hover:text-[#6b6b75] hover:bg-[#2a2a2e]'
          )}
          title="Table of contents"
        >
          <List size={12} />
          TOC
        </button>

        {/* Feature 9 — Math button */}
        <button
          onClick={() => editor.chain().focus().insertContent('$$\n$$').run()}
          className="flex items-center gap-1.5 text-xs bg-[#1a1a1d] border border-[#2a2a2e] text-[#6b6b75] px-3 py-1.5 rounded-full hover:bg-[#2a2a2e] hover:text-[#a0a0aa] transition-colors"
          title="Insert math equation (KaTeX)"
        >
          <span className="text-[11px] font-mono">∑</span>
          Math
        </button>

        {/* Feature 13 — Share button */}
        <button
          onClick={() => setShowSharePanel(v => !v)}
          className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
            isPublic ? 'bg-[#34c972]/10 border-[#34c972]/30 text-[#34c972]' : 'bg-[#1a1a1d] border-[#2a2a2e] text-[#6b6b75] hover:bg-[#2a2a2e] hover:text-[#a0a0aa]'
          )}
          title="Share note"
        >
          <Share2 size={12} />
          {isPublic ? 'Shared' : 'Share'}
        </button>

        {/* Feature 12 — Related Notes button */}
        <button
          onClick={handleRelated}
          className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
            showRelated ? 'bg-[#7c6af7]/10 border-[#7c6af7]/30 text-[#7c6af7]' : 'bg-[#1a1a1d] border-[#2a2a2e] text-[#6b6b75] hover:bg-[#2a2a2e] hover:text-[#a0a0aa]'
          )}
          title="Find related notes"
        >
          <Link2 size={12} />
          Related
        </button>

        <button
          onClick={() => {
            const html = editor.getHTML()
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
        <button
          onClick={() => setShowStats(v => !v)}
          className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
            showStats ? 'bg-[#7c6af7]/10 border-[#7c6af7]/30 text-[#7c6af7]' : 'bg-[#1a1a1d] border-[#2a2a2e] text-[#4a4a55] hover:text-[#6b6b75] hover:bg-[#2a2a2e]'
          )}
          title="Note statistics"
        >
          <BarChart2 size={12} />
          {wordCount} words
        </button>
        <button
          onClick={() => setIsReadMode(v => !v)}
          className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
            isReadMode ? 'bg-[#7c6af7]/10 border-[#7c6af7]/30 text-[#7c6af7]' : 'bg-[#1a1a1d] border-[#2a2a2e] text-[#6b6b75] hover:bg-[#2a2a2e] hover:text-[#a0a0aa]'
          )}
          title="Toggle reading mode"
        >
          {isReadMode ? <Edit3 size={12} /> : <BookOpen size={12} />}
          {isReadMode ? 'Edit' : 'Read'}
        </button>
        <div className={cn(
          'flex items-center gap-1.5 text-xs transition-colors',
          saveStatus === 'saved' ? 'text-[#34c972]' : saveStatus === 'saving' ? 'text-[#f5a623]' : 'text-[#4a4a55]'
        )}>
          <div className={cn('w-1.5 h-1.5 rounded-full', saveStatus === 'saving' && 'animate-pulse', saveStatus === 'saved' ? 'bg-[#34c972]' : saveStatus === 'saving' ? 'bg-[#f5a623]' : 'bg-[#4a4a55]')} />
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'}
        </div>
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={isUploadingImage}
          className="flex items-center gap-1.5 text-xs bg-[#1a1a1d] border border-[#2a2a2e] text-[#6b6b75] px-3 py-1.5 rounded-full hover:bg-[#2a2a2e] hover:text-[#a0a0aa] transition-colors disabled:opacity-50"
          title="Upload image (or drag & drop)"
        >
          <ImagePlus size={12} />
          {isUploadingImage ? 'Uploading…' : 'Image'}
        </button>
        {isSpeechSupported && (
          <button
            onClick={toggleRecording}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
              isRecording
                ? 'bg-[#f56565]/15 border-[#f56565]/30 text-[#f56565] hover:bg-[#f56565]/20'
                : 'bg-[#1a1a1d] border-[#2a2a2e] text-[#6b6b75] hover:bg-[#2a2a2e] hover:text-[#a0a0aa]'
            )}
            title="Voice dictation (click to start/stop)"
          >
            {isRecording ? <MicOff size={12} /> : <Mic size={12} />}
            {isRecording ? 'Stop' : 'Dictate'}
          </button>
        )}
        <button
          onClick={summarizeDoc}
          disabled={isSummarizing || (editor?.getText().trim().length ?? 0) < 50}
          className="flex items-center gap-1.5 text-xs bg-[#1a1a1d] border border-[#2a2a2e] text-[#7c6af7] px-3 py-1.5 rounded-full hover:bg-[#2a2a2e] transition-colors disabled:opacity-50"
          title="Summarize this note with AI"
        >
          <FileText size={12} />
          {isSummarizing ? 'Summarizing…' : 'Summarize'}
        </button>
        <button
          onClick={() => { setShowHistory(h => !h); if (!showHistory) loadVersions() }}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
            showHistory ? 'bg-[#7c6af7]/10 border-[#7c6af7]/30 text-[#7c6af7]' : 'bg-[#1a1a1d] border-[#2a2a2e] text-[#6b6b75] hover:bg-[#2a2a2e] hover:text-[#a0a0aa]'
          )}
          title="View version history"
        >
          <History size={12} />
          History
        </button>
        <button
          onClick={triggerAI}
          disabled={isGenerating}
          className="flex items-center gap-1.5 text-xs bg-[#1a1a1d] border border-[#2a2a2e] text-[#7c6af7] px-3 py-1.5 rounded-full hover:bg-[#2a2a2e] transition-colors disabled:opacity-50"
        >
          <Sparkles size={12} />
          {isGenerating ? 'Writing…' : 'AI Complete'}
        </button>
      </div>

      {/* Version History Panel */}
      {showHistory && (
        <div className="fixed right-0 top-0 h-full w-80 bg-[#0d0d0f] border-l border-[#1e1e22] z-50 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#1e1e22]">
            <div className="flex items-center gap-2">
              <History size={14} className="text-[#7c6af7]" />
              <span className="text-sm font-semibold text-[#e8e8ed]">Version History</span>
            </div>
            <button onClick={() => setShowHistory(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-[#4a4a55] hover:text-[#6b6b75] hover:bg-[#1e1e22] transition-colors">
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
              </div>
            ) : versions.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#4a4a55]">No saved versions yet.<br/>Versions are saved automatically every 5 minutes while editing.</div>
            ) : versions.map(v => (
              <div key={v.id} className="px-4 py-3 border-b border-[#1e1e22] group hover:bg-[#141416] transition-colors">
                <div className="text-xs text-[#a0a0aa] mb-1">{new Date(v.created_at).toLocaleString()}</div>
                <div className="text-[11px] text-[#4a4a55] mb-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: v.content_html.replace(/<[^>]+>/g,'').slice(0,120) }} />
                <button
                  onClick={() => restoreVersion(v.content_html)}
                  className="flex items-center gap-1.5 text-[10px] text-[#7c6af7] hover:text-[#9080ff] transition-colors"
                >
                  <RotateCcw size={10} /> Restore this version
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature 12 — Related Notes Panel */}
      {showRelated && (
        <div className="fixed right-0 top-0 h-full w-72 bg-[#0d0d0f] border-l border-[#1e1e22] z-50 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#1e1e22]">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-[#7c6af7]" />
              <span className="text-sm font-semibold text-[#e8e8ed]">Related Notes</span>
            </div>
            <button onClick={() => setShowRelated(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-[#4a4a55] hover:text-[#6b6b75] hover:bg-[#1e1e22] transition-colors">
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {isLoadingRelated ? (
              <div className="flex justify-center py-8">
                <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
              </div>
            ) : relatedDocs.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#4a4a55]">No related notes found.<br/>Add more content to find semantic connections.</div>
            ) : relatedDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => { setShowRelated(false); window.location.href = `/docs/${doc.id}` }}
                className="w-full px-4 py-3 text-left border-b border-[#1e1e22] hover:bg-[#141416] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{doc.icon || '📄'}</span>
                  <span className="text-xs text-[#e8e8ed] truncate group-hover:text-[#7c6af7] transition-colors">{doc.title || 'Untitled'}</span>
                </div>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {doc.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-[9px] text-[#4a4a55] bg-[#1e1e22] px-1.5 py-0.5 rounded-full">#{t}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Outer wrapper — handles Yjs lifecycle, presence, only renders EditorInner once ydoc is ready
export default function NexusEditor({ docId, initialTitle, initialTags, initialIcon, initialIsPublic, initialPublicSlug, userId, userEmail, docs, onUpdateIcon, onTogglePublic }: {
  docId: string
  initialTitle: string
  initialTags?: string[]
  initialIcon?: string | null
  initialIsPublic?: boolean
  initialPublicSlug?: string | null
  userId: string
  userEmail?: string | null
  docs?: DocMeta[]
  onUpdateIcon?: (icon: string | null) => void
  onTogglePublic?: () => Promise<string | null>
}) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const supabase = getSupabaseClient()

  // Real-time presence — shows who else is currently editing this document
  const presenceUser = userId ? { id: userId, email: userEmail } : null
  const { activeUsers } = usePresence(docId, presenceUser)

  useEffect(() => {
    if (docs) updatePagesList(docs.map(d => ({ id: d.id, title: d.title })))
  }, [docs])

  useEffect(() => {
    const doc = new Y.Doc()
    const persistence = new IndexeddbPersistence(`nexus-doc-${docId}`, doc)

    const syncToCloud = debounce(async () => {
      const update = Y.encodeStateAsUpdate(doc)
      const ytext = doc.getText('content')
      const textContent = ytext.toString()

      await supabase.from('docs').update({
        content: Array.from(update),
        text_content: textContent,
        updated_at: new Date().toISOString(),
      }).eq('id', docId)

      // Auto-backup text to localStorage (fallback if web app is unavailable)
      try {
        const backupKey = `nexus-note-${docId}`
        localStorage.setItem(backupKey, JSON.stringify({
          id: docId,
          text: textContent,
          saved_at: new Date().toISOString(),
        }))
        const indexRaw = localStorage.getItem('nexus-backup-index')
        const index: string[] = indexRaw ? JSON.parse(indexRaw) : []
        if (!index.includes(docId)) {
          index.push(docId)
          localStorage.setItem('nexus-backup-index', JSON.stringify(index))
        }
      } catch {} // storage quota exceeded — silently skip

      // Generate and store embedding for semantic search (fire-and-forget)
      if (textContent.trim().length > 30) {
        try {
          const resp = await fetch('/api/ai/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textContent.slice(0, 512) }),
          })
          const { embedding } = await resp.json()
          if (embedding) await supabase.from('docs').update({ embedding }).eq('id', docId)
        } catch {}
      }
    }, 2000)

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

  return (
    <div>
      {/* Presence bar — only visible when collaborators are in the doc */}
      {activeUsers.length > 0 && (
        <div className="sticky top-0 z-30 flex items-center justify-end px-8 py-2 bg-[#0d0d0f]/80 backdrop-blur-sm border-b border-[#1e1e22]">
          <PresenceAvatars users={activeUsers} />
        </div>
      )}
      <EditorInner
        docId={docId}
        initialTitle={initialTitle}
        initialTags={initialTags || []}
        initialIcon={initialIcon}
        initialIsPublic={initialIsPublic}
        initialPublicSlug={initialPublicSlug}
        ydoc={ydoc}
        onUpdateIcon={onUpdateIcon}
        onTogglePublic={onTogglePublic}
        docs={docs}
      />
    </div>
  )
}
