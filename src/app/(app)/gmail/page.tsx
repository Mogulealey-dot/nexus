'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, RefreshCw, Unlink, AlertCircle, Inbox, ArrowUpRight, FileText, CheckSquare, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface GmailEmail {
  id: string
  from: string
  subject: string
  date: string
  snippet: string
  priority: 'HIGH' | 'NORMAL' | 'LOW'
  reason: string
  rank: number
}

interface EmailsResponse {
  connected: boolean
  emails?: GmailEmail[]
  error?: string
}

const PRIORITY_CONFIG = {
  HIGH:   { label: 'High',   dot: 'bg-[#f56565]', badge: 'bg-[#f56565]/10 text-[#f56565] border-[#f56565]/20' },
  NORMAL: { label: 'Normal', dot: 'bg-[#f5a623]', badge: 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/20' },
  LOW:    { label: 'Low',    dot: 'bg-[#34c972]', badge: 'bg-[#34c972]/10 text-[#34c972] border-[#34c972]/20' },
}

function formatFrom(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*<?[^>]*>?$/)
  return match ? match[1].trim() : from
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function GmailPage() {
  const searchParams = useSearchParams()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [emails, setEmails] = useState<GmailEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [creatingTasks, setCreatingTasks] = useState(false)
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)
  const [tasksCreated, setTasksCreated] = useState<number | null>(null)

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gmail/emails')
      const data: EmailsResponse = await res.json()
      setConnected(data.connected)
      if (data.connected) {
        setEmails(data.emails ?? [])
        if (data.error) setError(data.error)
      }
    } catch {
      setError('Failed to load emails')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  // Show toast if redirected back after OAuth
  const oauthError = searchParams.get('error')
  const justConnected = searchParams.get('connected') === '1'

  const handleConnect = () => {
    window.location.href = '/api/gmail/auth'
  }

  const handleSaveNote = async () => {
    setSavingNote(true)
    setSavedNoteId(null)
    try {
      const res = await fetch('/api/gmail/save-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      const data = await res.json()
      if (data.docId) setSavedNoteId(data.docId)
    } catch {
      setError('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  const handleCreateTasks = async () => {
    setCreatingTasks(true)
    setTasksCreated(null)
    try {
      const res = await fetch('/api/gmail/create-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      const data = await res.json()
      if (data.created) setTasksCreated(data.created)
    } catch {
      setError('Failed to create tasks')
    } finally {
      setCreatingTasks(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch('/api/gmail/disconnect', { method: 'DELETE' })
      setConnected(false)
      setEmails([])
    } catch {
      setError('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  // Group emails by priority for section headers
  const highEmails   = emails.filter(e => e.priority === 'HIGH')
  const normalEmails = emails.filter(e => e.priority === 'NORMAL')
  const lowEmails    = emails.filter(e => e.priority === 'LOW')

  return (
    <div className="min-h-screen bg-[#0d0d0f] px-6 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ea4335]/10 border border-[#ea4335]/20 flex items-center justify-center">
            <Mail size={18} className="text-[#ea4335]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#e8e8ed]">Gmail Inbox</h1>
            {connected && emails.length > 0 && (
              <p className="text-xs text-[#4a4a55]">{emails.length} unread · ranked by priority</p>
            )}
          </div>
        </div>

        {connected && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {emails.length > 0 && (
              <>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#7c6af7]/10 text-[#7c6af7] border border-[#7c6af7]/20 hover:bg-[#7c6af7]/20 transition-colors disabled:opacity-50"
                >
                  {savedNoteId ? <Check size={12} /> : <FileText size={12} />}
                  {savingNote ? 'Saving…' : savedNoteId ? 'Note Saved!' : 'Save as Note'}
                </button>
                <button
                  onClick={handleCreateTasks}
                  disabled={creatingTasks}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#34c972]/10 text-[#34c972] border border-[#34c972]/20 hover:bg-[#34c972]/20 transition-colors disabled:opacity-50"
                >
                  {tasksCreated ? <Check size={12} /> : <CheckSquare size={12} />}
                  {creatingTasks ? 'Creating…' : tasksCreated ? `${tasksCreated} Tasks Created!` : 'Create Tasks'}
                </button>
              </>
            )}
            <button
              onClick={fetchEmails}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#6b6b75] bg-[#141416] border border-[#1e1e22] hover:border-[#2a2a2e] hover:text-[#a0a0aa] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#6b6b75] bg-[#141416] border border-[#1e1e22] hover:border-[#f56565]/40 hover:text-[#f56565] transition-colors disabled:opacity-50"
            >
              <Unlink size={12} />
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* OAuth error banner */}
      {oauthError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-[#f56565]/10 border border-[#f56565]/20 text-[#f56565] text-sm">
          <AlertCircle size={14} />
          {oauthError === 'access_denied' ? 'Gmail access was denied.' : 'Failed to connect Gmail. Please try again.'}
        </div>
      )}

      {/* Saved note banner */}
      {savedNoteId && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-lg bg-[#7c6af7]/10 border border-[#7c6af7]/20 text-[#7c6af7] text-sm">
          <span>Note saved successfully!</span>
          <a href={`/docs/${savedNoteId}`} className="underline text-xs hover:text-[#9080ff]">Open note →</a>
        </div>
      )}

      {/* Tasks created banner */}
      {tasksCreated && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-lg bg-[#34c972]/10 border border-[#34c972]/20 text-[#34c972] text-sm">
          <span>{tasksCreated} tasks created from your emails!</span>
          <a href="/tasks" className="underline text-xs hover:text-[#34c972]/80">View tasks →</a>
        </div>
      )}

      {/* Just connected banner */}
      {justConnected && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-[#34c972]/10 border border-[#34c972]/20 text-[#34c972] text-sm">
          Gmail connected successfully!
        </div>
      )}

      {/* Not connected */}
      {connected === false && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mb-5">
            <Mail size={28} className="text-[#3a3a3f]" />
          </div>
          <h2 className="text-base font-semibold text-[#e8e8ed] mb-2">Connect your Gmail</h2>
          <p className="text-sm text-[#4a4a55] max-w-xs mb-6">
            View your unread emails ranked by priority — powered by Claude AI.
          </p>
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ea4335] hover:bg-[#c83226] text-white text-sm font-semibold transition-colors shadow-lg shadow-[#ea4335]/20"
          >
            <Mail size={15} />
            Connect Gmail
            <ArrowUpRight size={13} />
          </button>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {connected && loading && emails.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-xl bg-[#141416] border border-[#1e1e22] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {connected && !loading && emails.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Inbox size={32} className="text-[#2a2a2e] mb-3" />
          <p className="text-sm text-[#4a4a55]">No unread emails — you&apos;re all caught up!</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-[#f56565]/10 border border-[#f56565]/20 text-[#f56565] text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Email list */}
      {connected && emails.length > 0 && (
        <AnimatePresence>
          <div className="space-y-6">
            {[
              { label: 'High Priority', items: highEmails, priority: 'HIGH' as const },
              { label: 'Normal Priority', items: normalEmails, priority: 'NORMAL' as const },
              { label: 'Low Priority', items: lowEmails, priority: 'LOW' as const },
            ]
              .filter(g => g.items.length > 0)
              .map((group, gi) => (
                <motion.div
                  key={group.priority}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.05 }}
                >
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[group.priority].dot}`} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3a3a3f]">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-[#2a2a2e] bg-[#1a1a1d] px-1.5 py-0.5 rounded-full border border-[#2a2a2e]">
                      {group.items.length}
                    </span>
                  </div>

                  {/* Email cards */}
                  <div className="space-y-1.5">
                    {group.items.map((email, i) => (
                      <motion.div
                        key={email.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: gi * 0.05 + i * 0.03 }}
                        className="group relative flex flex-col gap-1 px-4 py-3 rounded-xl bg-[#111113] border border-[#1e1e22] hover:border-[#2a2a2e] hover:bg-[#141416] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Rank badge */}
                            <span className="flex-shrink-0 w-5 h-5 rounded-md bg-[#1a1a1d] border border-[#2a2a2e] flex items-center justify-center text-[10px] font-mono text-[#4a4a55]">
                              {email.rank === 1 ? highEmails.indexOf(email) + 1
                                : email.rank === 2 ? emails.filter(e => e.rank <= 1).length + normalEmails.indexOf(email) + 1
                                : emails.filter(e => e.rank <= 2).length + lowEmails.indexOf(email) + 1}
                            </span>
                            <span className="text-sm font-medium text-[#e8e8ed] truncate">
                              {formatFrom(email.from)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${PRIORITY_CONFIG[email.priority].badge}`}>
                              {PRIORITY_CONFIG[email.priority].label}
                            </span>
                            <span className="text-[11px] text-[#3a3a3f]">{formatDate(email.date)}</span>
                          </div>
                        </div>

                        <p className="text-xs font-medium text-[#a0a0aa] truncate ml-7">
                          {email.subject}
                        </p>

                        <p className="text-xs text-[#4a4a55] line-clamp-1 ml-7">
                          {email.snippet}
                        </p>

                        {email.reason && (
                          <p className="text-[10px] text-[#3a3a3f] ml-7 italic">
                            AI: {email.reason}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
