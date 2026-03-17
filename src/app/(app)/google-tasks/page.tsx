'use client'
import { useState, useEffect, useCallback } from 'react'
import { CheckSquare, RefreshCw, AlertCircle, Check, Clock } from 'lucide-react'

interface GoogleTask {
  id: string
  title: string
  status: 'needsAction' | 'completed'
  due: string | null
  notes: string | null
  updated: string | null
}

interface TaskList {
  listId: string
  listTitle: string
  items: GoogleTask[]
}

interface ApiResponse {
  connected: boolean
  insufficientScopes?: boolean
  lists?: TaskList[]
  error?: string
}

function formatDue(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86400000)
  if (d.toDateString() === today.toDateString()) return { label: 'Today', color: 'text-[#34c972]' }
  if (d.toDateString() === tomorrow.toDateString()) return { label: 'Tomorrow', color: 'text-[#f5a623]' }
  if (d < today) return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-[#f56565]' }
  return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-[#6b6b75]' }
}

export default function GoogleTasksPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/google/tasks')
      setData(await res.json())
    } catch {
      setData({ connected: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center animate-pulse">
            <CheckSquare size={20} className="text-[#7c6af7]" />
          </div>
          <p className="text-sm text-[#4a4a55]">Loading Google Tasks…</p>
        </div>
      </div>
    )
  }

  if (!data?.connected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
            <CheckSquare size={28} className="text-[#7c6af7]" />
          </div>
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Connect Google Tasks</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Connect your Google account via Gmail to also access Google Tasks.
          </p>
          <a
            href="/api/gmail/auth"
            className="inline-flex items-center gap-2 bg-[#7c6af7] hover:bg-[#9080ff] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <CheckSquare size={15} />
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
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Tasks Access Required</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Your existing Google connection doesn't include Tasks access. Please reconnect to grant Tasks permissions.
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

  const lists = data.lists || []
  const totalTasks = lists.reduce((sum, l) => sum + l.items.length, 0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8e8ed]">Google Tasks</h1>
          <p className="text-sm text-[#4a4a55] mt-0.5">
            {totalTasks} task{totalTasks !== 1 ? 's' : ''} remaining · {lists.length} list{lists.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchTasks}
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

      {totalTasks === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
            <Check size={20} className="text-[#34c972]" />
          </div>
          <p className="text-sm text-[#4a4a55]">All done! No pending tasks in Google Tasks.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {lists.filter(l => l.items.length > 0).map((list, listIdx) => (
            <div key={list.listId}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-3 px-1 text-[#7c6af7]">
                {list.listTitle} <span className="font-normal opacity-60">({list.items.length})</span>
              </div>
              <div className="space-y-1.5">
                {list.items.map((task, i) => {
                  const dueInfo = formatDue(task.due)
                  // Global sequential number across all lists
                  const globalNum = lists.slice(0, listIdx).reduce((sum, l) => sum + l.items.length, 0) + i + 1
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 bg-[#141416] border border-[#1e1e22] hover:border-[#2a2a2e] rounded-xl px-4 py-3 transition-all"
                    >
                      <span className="w-5 text-center text-[10px] font-semibold text-[#3a3a3f] flex-shrink-0 select-none">
                        {globalNum}
                      </span>
                      <div className="w-5 h-5 rounded-full border-2 border-[#7c6af7] flex items-center justify-center flex-shrink-0">
                        {task.status === 'completed' && <Check size={11} className="text-[#7c6af7]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[#e8e8ed] truncate block">{task.title}</span>
                        {task.notes && (
                          <span className="text-xs text-[#4a4a55] truncate block mt-0.5">{task.notes}</span>
                        )}
                      </div>
                      {dueInfo && (
                        <span className={`text-xs flex items-center gap-1 flex-shrink-0 ${dueInfo.color}`}>
                          <Clock size={11} />
                          {dueInfo.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
