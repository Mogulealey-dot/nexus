'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, RefreshCw, ExternalLink, AlertCircle, ChevronLeft, Loader2, Download } from 'lucide-react'

interface GSheet {
  id: string
  name: string
  modifiedTime: string
  webViewLink: string | null
  owner: string | null
}

interface SheetData {
  id: string
  title: string
  sheetNames: string[]
  rows: string[][]
}

interface ListResponse {
  connected: boolean
  insufficientScopes?: boolean
  files?: GSheet[]
  error?: string
}

interface ContentResponse {
  connected: boolean
  sheet?: SheetData
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

function SheetTable({ rows }: { rows: string[][] }) {
  if (!rows.length) return <p className="text-sm text-[#4a4a55] py-8 text-center">(Empty sheet)</p>

  const headers = rows[0]
  const body = rows.slice(1)
  const hasData = body.some(r => r.some(c => c))

  return (
    <div className="overflow-auto rounded-xl border border-[#1e1e22]">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#1a1a1d]">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-[#a0a0aa] font-semibold border-b border-[#1e1e22] whitespace-nowrap">
                {h || <span className="text-[#3a3a3f]">{String.fromCharCode(65 + i)}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasData ? body.map((row, ri) => (
            <tr key={ri} className="border-b border-[#1a1a1d] hover:bg-[#1a1a1d]/50 transition-colors">
              {headers.map((_, ci) => (
                <td key={ci} className="px-3 py-2 text-[#c8c8d0] whitespace-nowrap max-w-[200px] truncate">
                  {row[ci] || ''}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={headers.length} className="px-3 py-8 text-center text-[#4a4a55]">No data rows</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function GSheetsPage() {
  const router = useRouter()
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GSheet | null>(null)
  const [sheetData, setSheetData] = useState<SheetData | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)

  const fetchSheets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/google/sheets')
      setData(await res.json())
    } catch {
      setData({ connected: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSheets() }, [fetchSheets])

  const openSheet = async (sheet: GSheet) => {
    setSelected(sheet)
    setSheetData(null)
    setContentLoading(true)
    try {
      const res = await fetch(`/api/google/sheets?id=${sheet.id}`)
      const json: ContentResponse = await res.json()
      if (json.sheet) setSheetData(json.sheet)
    } catch {
      // fail silently
    } finally {
      setContentLoading(false)
    }
  }

  const importToNexus = async (sheet: GSheet, e: React.MouseEvent) => {
    e.stopPropagation()
    setImporting(sheet.id)
    try {
      const contentRes = await fetch(`/api/google/sheets?id=${sheet.id}`)
      const contentJson: ContentResponse = await contentRes.json()
      if (!contentJson.sheet) throw new Error('Could not read sheet content')

      // Convert rows to tab-separated text
      const text = contentJson.sheet.rows.map(row => row.join('\t')).join('\n')

      const importRes = await fetch('/api/nexus/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: sheet.name, text, source: 'Google Sheets', icon: '📊' }),
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
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-8 sm:py-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center animate-pulse">
            <Sheet size={20} className="text-[#34c972]" />
          </div>
          <p className="text-sm text-[#4a4a55]">Loading Google Sheets…</p>
        </div>
      </div>
    )
  }

  if (!data?.connected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
            <Sheet size={28} className="text-[#34c972]" />
          </div>
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Connect Google Sheets</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Connect your Google account to browse and preview your Sheets.
          </p>
          <a
            href="/api/gmail/auth"
            className="inline-flex items-center gap-2 bg-[#34c972] hover:bg-[#44d982] text-[#0d0d0f] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Sheet size={15} />
            Connect Google Account
          </a>
        </div>
      </div>
    )
  }

  if (data.insufficientScopes) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#f56565]/10 border border-[#f56565]/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-[#f56565]" />
          </div>
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Sheets Access Required</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Please reconnect your Google account to grant Sheets permissions.
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

  // Sheet data preview panel
  if (selected) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => { setSelected(null); setSheetData(null) }}
            className="flex items-center gap-1.5 text-sm text-[#6b6b75] hover:text-[#e8e8ed] transition-colors"
          >
            <ChevronLeft size={15} /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#e8e8ed] truncate">{selected.name}</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-[#4a4a55]">Modified {formatModifiedTime(selected.modifiedTime)}</p>
              {sheetData && sheetData.sheetNames.length > 1 && (
                <p className="text-xs text-[#4a4a55]">{sheetData.sheetNames.length} sheets · showing "{sheetData.sheetNames[0]}"</p>
              )}
            </div>
          </div>
          {selected.webViewLink && (
            <a
              href={selected.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#34c972] hover:bg-[#44d982] text-[#0d0d0f] text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex-shrink-0"
            >
              <ExternalLink size={13} /> Open in Sheets
            </a>
          )}
        </div>

        <div className="min-h-[300px]">
          {contentLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="text-[#34c972] animate-spin" />
            </div>
          ) : sheetData ? (
            <SheetTable rows={sheetData.rows} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-[#141416] border border-[#1e1e22] rounded-2xl gap-3">
              <p className="text-sm text-[#4a4a55]">Could not load preview.</p>
              {selected.webViewLink && (
                <a href={selected.webViewLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[#34c972] hover:text-[#44d982]">
                  Open in Google Sheets →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8e8ed]">Google Sheets</h1>
          <p className="text-sm text-[#4a4a55] mt-0.5">
            {files.length} spreadsheet{files.length !== 1 ? 's' : ''} · recently modified
          </p>
        </div>
        <button
          onClick={fetchSheets}
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
          <Sheet size={24} className="text-[#3a3a3f] mx-auto mb-3" />
          <p className="text-sm text-[#4a4a55]">No Google Sheets found.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map(file => (
            <div
              key={file.id}
              onClick={() => openSheet(file)}
              className="group flex items-center gap-3 bg-[#141416] border border-[#1e1e22] hover:border-[#34c972]/40 rounded-xl px-4 py-3 cursor-pointer transition-all"
            >
              <Sheet size={16} className="text-[#34c972] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[#e8e8ed] truncate block group-hover:text-white">{file.name}</span>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-[#4a4a55]">{formatModifiedTime(file.modifiedTime)}</span>
                  {file.owner && <span className="text-xs text-[#3a3a3f] truncate">{file.owner}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4a4a55] hover:text-[#34c972] hover:bg-[#34c972]/10 transition-all"
                    title="Open in Google Sheets"
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
