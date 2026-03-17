'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, RefreshCw, ExternalLink, AlertCircle, ChevronLeft, Loader2, Download } from 'lucide-react'

interface GDoc {
  id: string
  name: string
  modifiedTime: string
  webViewLink: string | null
  owner: string | null
}

interface DocContent {
  id: string
  title: string
  text: string
}

interface ListResponse {
  connected: boolean
  insufficientScopes?: boolean
  files?: GDoc[]
  error?: string
}

interface ContentResponse {
  connected: boolean
  doc?: DocContent
  error?: string
}

function formatModifiedTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined })
}

export default function GDocsPage() {
  const router = useRouter()
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GDoc | null>(null)
  const [docContent, setDocContent] = useState<DocContent | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null) // file id being imported

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/google/docs')
      setData(await res.json())
    } catch {
      setData({ connected: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const openDoc = async (doc: GDoc) => {
    setSelected(doc)
    setDocContent(null)
    setContentLoading(true)
    try {
      const res = await fetch(`/api/google/docs?id=${doc.id}`)
      const json: ContentResponse = await res.json()
      if (json.doc) setDocContent(json.doc)
    } catch {
      // fail silently — user can still open in Google Docs
    } finally {
      setContentLoading(false)
    }
  }

  const importToNexus = async (doc: GDoc, e: React.MouseEvent) => {
    e.stopPropagation()
    setImporting(doc.id)
    try {
      // Fetch doc content
      const contentRes = await fetch(`/api/google/docs?id=${doc.id}`)
      const contentJson: ContentResponse = await contentRes.json()
      if (!contentJson.doc) throw new Error('Could not read document content')

      // Create Nexus note
      const importRes = await fetch('/api/nexus/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: doc.name, text: contentJson.doc.text, source: 'Google Docs', icon: '📄' }),
      })
      const { docId } = await importRes.json()
      if (docId) router.push(`/docs/${docId}`)
    } catch {
      // fail silently
    } finally {
      setImporting(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center animate-pulse">
            <FileText size={20} className="text-[#4a90d9]" />
          </div>
          <p className="text-sm text-[#4a4a55]">Loading Google Docs…</p>
        </div>
      </div>
    )
  }

  if (!data?.connected) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-[#4a90d9]" />
          </div>
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Connect Google Docs</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Connect your Google account to browse and preview your Docs.
          </p>
          <a
            href="/api/gmail/auth"
            className="inline-flex items-center gap-2 bg-[#4a90d9] hover:bg-[#5aa0e9] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <FileText size={15} />
            Connect Google Account
          </a>
        </div>
      </div>
    )
  }

  if (data.insufficientScopes) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#f56565]/10 border border-[#f56565]/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-[#f56565]" />
          </div>
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Docs Access Required</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Please reconnect your Google account to grant Docs permissions.
          </p>
          <a
            href="/api/gmail/auth"
            className="inline-flex items-center gap-2 bg-[#7c6af7] hover:bg-[#9080ff] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Reconnect Google Account
          </a>
        </div>
      </div>
    )
  }

  const files = data.files || []

  // Document preview panel
  if (selected) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => { setSelected(null); setDocContent(null) }}
            className="flex items-center gap-1.5 text-sm text-[#6b6b75] hover:text-[#e8e8ed] transition-colors"
          >
            <ChevronLeft size={15} /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#e8e8ed] truncate">{selected.name}</h1>
            <p className="text-xs text-[#4a4a55] mt-0.5">Modified {formatModifiedTime(selected.modifiedTime)}</p>
          </div>
          {selected.webViewLink && (
            <a
              href={selected.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#4a90d9] hover:bg-[#5aa0e9] text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex-shrink-0"
            >
              <ExternalLink size={13} /> Open in Docs
            </a>
          )}
        </div>

        <div className="bg-[#141416] border border-[#1e1e22] rounded-2xl p-6 min-h-[400px]">
          {contentLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="text-[#4a90d9] animate-spin" />
            </div>
          ) : docContent ? (
            <pre className="text-sm text-[#c8c8d0] whitespace-pre-wrap font-sans leading-relaxed">
              {docContent.text || '(Empty document)'}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-[#4a4a55]">Could not load preview.</p>
              {selected.webViewLink && (
                <a href={selected.webViewLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4a90d9] hover:text-[#5aa0e9]">
                  Open in Google Docs →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8e8ed]">Google Docs</h1>
          <p className="text-sm text-[#4a4a55] mt-0.5">
            {files.length} document{files.length !== 1 ? 's' : ''} · recently modified
          </p>
        </div>
        <button
          onClick={fetchDocs}
          className="flex items-center gap-2 bg-[#141416] hover:bg-[#1e1e22] border border-[#1e1e22] text-[#6b6b75] hover:text-[#e8e8ed] text-sm px-3 py-2 rounded-xl transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {data.error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#f56565]/10 border border-[#f56565]/20 text-[#f56565] text-sm">
          {data.error}
        </div>
      )}

      {files.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={24} className="text-[#3a3a3f] mx-auto mb-3" />
          <p className="text-sm text-[#4a4a55]">No Google Docs found.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map(file => (
            <div
              key={file.id}
              onClick={() => openDoc(file)}
              className="group flex items-center gap-3 bg-[#141416] border border-[#1e1e22] hover:border-[#4a90d9]/40 rounded-xl px-4 py-3 cursor-pointer transition-all"
            >
              <FileText size={16} className="text-[#4a90d9] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[#e8e8ed] truncate block group-hover:text-white">{file.name}</span>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-[#4a4a55]">{formatModifiedTime(file.modifiedTime)}</span>
                  {file.owner && <span className="text-xs text-[#3a3a3f] truncate">{file.owner}</span>}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0 transition-opacity">
                <button
                  onClick={(e) => importToNexus(file, e)}
                  disabled={importing === file.id}
                  className="flex items-center gap-1 text-[10px] bg-[#7c6af7]/10 border border-[#7c6af7]/20 text-[#7c6af7] px-2 py-1 rounded-lg hover:bg-[#7c6af7]/20 transition-colors disabled:opacity-50"
                  title="Import to Nexus"
                >
                  {importing === file.id ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                  Import
                </button>
                {file.webViewLink && (
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4a4a55] hover:text-[#4a90d9] hover:bg-[#4a90d9]/10 transition-all"
                    title="Open in Google Docs"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
