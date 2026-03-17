'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { HardDrive, RefreshCw, Search, ExternalLink, AlertCircle, FileText, FileImage, FileVideo, FileCode, FolderOpen, Sheet, Download, Loader2 } from 'lucide-react'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size: number | null
  webViewLink: string | null
  iconLink: string | null
  owner: string | null
}

interface ApiResponse {
  connected: boolean
  insufficientScopes?: boolean
  files?: DriveFile[]
  error?: string
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatModifiedTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined })
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const cls = 'flex-shrink-0'
  if (mimeType.includes('folder')) return <FolderOpen size={16} className={`${cls} text-[#f5a623]`} />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <Sheet size={16} className={`${cls} text-[#34c972]`} />
  if (mimeType.includes('image')) return <FileImage size={16} className={`${cls} text-[#7c6af7]`} />
  if (mimeType.includes('video')) return <FileVideo size={16} className={`${cls} text-[#f56565]`} />
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('html') || mimeType.includes('xml')) {
    return <FileCode size={16} className={`${cls} text-[#4a90d9]`} />
  }
  return <FileText size={16} className={`${cls} text-[#6b6b75]`} />
}

function getMimeLabel(mimeType: string) {
  if (mimeType.includes('folder')) return 'Folder'
  if (mimeType.includes('google-apps.document')) return 'Doc'
  if (mimeType.includes('google-apps.spreadsheet')) return 'Sheet'
  if (mimeType.includes('google-apps.presentation')) return 'Slides'
  if (mimeType.includes('google-apps.form')) return 'Form'
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'Word'
  if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) return 'Excel'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('image')) return 'Image'
  if (mimeType.includes('video')) return 'Video'
  if (mimeType.includes('text/')) return 'Text'
  return 'File'
}

function isImportable(mimeType: string) {
  return (
    mimeType.startsWith('text/') ||
    mimeType.includes('markdown') ||
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType.includes('spreadsheetml') ||
    mimeType.includes('ms-excel') ||
    mimeType === 'application/vnd.google-apps.spreadsheet' ||
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('msword')
  )
}

export default function DrivePage() {
  const router = useRouter()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)

  const fetchFiles = useCallback(async (q = '') => {
    q ? setSearching(true) : setLoading(true)
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : ''
      const res = await fetch(`/api/google/drive${params}`)
      setData(await res.json())
    } catch {
      setData({ connected: false })
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchFiles(query)
  }

  const importToNexus = async (file: DriveFile) => {
    setImporting(file.id)
    try {
      const res = await fetch(`/api/google/drive?id=${file.id}&download=1`)
      const json = await res.json()
      if (!json.text && json.error) throw new Error(json.error)

      const isExcel = file.mimeType.includes('spreadsheetml') || file.mimeType.includes('ms-excel')
      const isWord = file.mimeType.includes('wordprocessingml') || file.mimeType.includes('msword')
      const icon = isExcel ? '📊' : isWord ? '📝' : '📄'
      const cleanTitle = file.name.replace(/\.(md|txt|xlsx|xls|docx|doc)$/i, '')
      const importRes = await fetch('/api/nexus/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle, text: json.text, source: 'Google Drive', icon }),
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
            <HardDrive size={20} className="text-[#7c6af7]" />
          </div>
          <p className="text-sm text-[#4a4a55]">Loading Drive…</p>
        </div>
      </div>
    )
  }

  if (!data?.connected) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
            <HardDrive size={28} className="text-[#7c6af7]" />
          </div>
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Connect Google Drive</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Connect your Google account via Gmail to also access Drive files.
          </p>
          <a
            href="/api/gmail/auth"
            className="inline-flex items-center gap-2 bg-[#7c6af7] hover:bg-[#9080ff] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <HardDrive size={15} />
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
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Drive Access Required</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Your existing Google connection doesn't include Drive access. Please reconnect to grant Drive permissions.
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

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8e8ed]">Drive</h1>
          <p className="text-sm text-[#4a4a55] mt-0.5">
            {files.length} file{files.length !== 1 ? 's' : ''} · recently modified
          </p>
        </div>
        <button
          onClick={() => fetchFiles(query)}
          className="flex items-center gap-2 bg-[#141416] hover:bg-[#1e1e22] border border-[#1e1e22] text-[#6b6b75] hover:text-[#e8e8ed] text-sm px-3 py-2 rounded-xl transition-colors"
        >
          <RefreshCw size={14} className={searching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex items-center gap-2 bg-[#141416] border border-[#1e1e22] rounded-xl px-4 py-2.5 focus-within:border-[#7c6af7]/50 transition-colors">
          <Search size={14} className="text-[#4a4a55] flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search files…"
            className="flex-1 bg-transparent outline-none text-sm text-[#e8e8ed] placeholder-[#3a3a3f]"
          />
          {query && (
            <button
              type="submit"
              className="text-xs bg-[#7c6af7] text-white px-2 py-1 rounded-lg hover:bg-[#9080ff] transition-colors"
            >
              Search
            </button>
          )}
        </div>
      </form>

      {data.error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#f56565]/10 border border-[#f56565]/20 text-[#f56565] text-sm">
          {data.error}
        </div>
      )}

      {files.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
            <HardDrive size={20} className="text-[#6b6b75]" />
          </div>
          <p className="text-sm text-[#4a4a55]">{query ? 'No files found.' : 'No files in Drive.'}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map(file => (
            <div
              key={file.id}
              className="group flex items-center gap-3 bg-[#141416] border border-[#1e1e22] hover:border-[#2a2a2e] rounded-xl px-4 py-3 transition-all"
            >
              <FileIcon mimeType={file.mimeType} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#e8e8ed] truncate">{file.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1e22] text-[#4a4a55] flex-shrink-0">
                    {getMimeLabel(file.mimeType)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-[#4a4a55]">{formatModifiedTime(file.modifiedTime)}</span>
                  {file.size && <span className="text-xs text-[#4a4a55]">{formatFileSize(file.size)}</span>}
                  {file.owner && <span className="text-xs text-[#3a3a3f] truncate">{file.owner}</span>}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0 transition-opacity">
                {isImportable(file.mimeType) && (
                  <button
                    onClick={() => importToNexus(file)}
                    disabled={importing === file.id}
                    className="flex items-center gap-1 text-[10px] bg-[#7c6af7]/10 border border-[#7c6af7]/20 text-[#7c6af7] px-2 py-1 rounded-lg hover:bg-[#7c6af7]/20 transition-colors disabled:opacity-50"
                    title="Import to Nexus"
                  >
                    {importing === file.id ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                    Import
                  </button>
                )}
                {file.webViewLink && (
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4a4a55] hover:text-[#7c6af7] hover:bg-[#7c6af7]/10 transition-all"
                    title="Open in Drive"
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
