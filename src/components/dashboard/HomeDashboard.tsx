'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Star, Clock, Sparkles, LayoutTemplate, ArrowRight, BookOpen, CheckSquare, Check } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { TEMPLATES } from '@/lib/templates'
import { useTasks } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import type { DocMeta } from '@/types'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User
  docs: DocMeta[]
  starred: DocMeta[]
  recent: DocMeta[]
  onCreateDoc: (parentId?: string) => Promise<string | null>
}

function greeting(name: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name}`
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function HomeDashboard({ user, docs, starred, recent, onCreateDoc }: Props) {
  const router = useRouter()
  const { setPendingTemplate, setCommandPaletteOpen } = useAppStore()
  const { todayTasks, overdueTasks, toggleTask } = useTasks(user?.id)
  const [quickTitle, setQuickTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const displayName = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const totalWords = docs.reduce((sum, d) => {
    const wc = (d as DocMeta & { text_content?: string }).text_content?.split(/\s+/).filter(Boolean).length || 0
    return sum + wc
  }, 0)

  const handleQuickCreate = async () => {
    if (!quickTitle.trim() && !creating) {
      const id = await onCreateDoc()
      if (id) router.push(`/docs/${id}`)
      return
    }
    setCreating(true)
    const id = await onCreateDoc()
    if (id) {
      // Title will be set by the editor, pass it via a short delay
      router.push(`/docs/${id}`)
    }
    setCreating(false)
    setQuickTitle('')
  }

  const handleTemplateCreate = async (templateId: string) => {
    setPendingTemplate(templateId)
    const id = await onCreateDoc()
    if (id) router.push(`/docs/${id}`)
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#9080ff] flex items-center justify-center">
            <Sparkles size={15} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8e8ed]">{greeting(displayName)}</h1>
        </div>
        <p className="text-sm text-[#4a4a55] ml-11">{today}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { icon: <FileText size={16} />, value: docs.length, label: 'Pages', color: 'text-[#7c6af7]' },
          { icon: <Star size={16} />, value: starred.length, label: 'Starred', color: 'text-[#f5a623]' },
          { icon: <CheckSquare size={16} />, value: todayTasks.length + overdueTasks.length, label: 'Tasks today', color: 'text-[#34c972]' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#141416] border border-[#1e1e22] rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className={`${stat.color} opacity-80`}>{stat.icon}</div>
            <div>
              <div className="text-xl font-bold text-[#e8e8ed]">{stat.value}</div>
              <div className="text-xs text-[#4a4a55]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick capture */}
      <div className="bg-[#141416] border border-[#1e1e22] rounded-2xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Plus size={14} className="text-[#7c6af7]" />
          <span className="text-xs font-semibold text-[#6b6b75] uppercase tracking-wider">Quick capture</span>
        </div>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-[#0d0d0f] border border-[#2a2a2e] rounded-xl px-4 py-2.5 text-sm text-[#e8e8ed] placeholder-[#3a3a3f] outline-none focus:border-[#7c6af7]/50 transition-colors"
            placeholder="What's on your mind? Press Enter to create a note…"
            value={quickTitle}
            onChange={e => setQuickTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleQuickCreate() }}
          />
          <button
            onClick={handleQuickCreate}
            disabled={creating}
            className="flex items-center gap-2 bg-[#7c6af7] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#9080ff] transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Plus size={14} />
            New page
          </button>
        </div>
      </div>

      {/* Today's tasks widget */}
      {(todayTasks.length > 0 || overdueTasks.length > 0) && (
        <div className="bg-[#141416] border border-[#1e1e22] rounded-2xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare size={14} className="text-[#34c972]" />
              <span className="text-xs font-semibold text-[#6b6b75] uppercase tracking-wider">
                Today's tasks
              </span>
            </div>
            <button onClick={() => router.push('/tasks')} className="text-xs text-[#4a4a55] hover:text-[#7c6af7] transition-colors flex items-center gap-1">
              All tasks <ArrowRight size={11} />
            </button>
          </div>
          <div className="space-y-1.5">
            {[...overdueTasks, ...todayTasks].slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#1a1a1d] transition-colors">
                <button
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    task.completed ? 'bg-[#34c972] border-[#34c972]' : 'border-[#3a3a3f] hover:border-[#7c6af7]'
                  )}
                >
                  {task.completed && <Check size={9} className="text-white" />}
                </button>
                <span className={cn('text-sm flex-1 truncate', task.completed ? 'line-through text-[#4a4a55]' : 'text-[#a0a0aa]')}>
                  {task.title}
                </span>
                {task.due_date && task.due_date < new Date().toISOString().split('T')[0] && (
                  <span className="text-[10px] text-[#f56565] flex-shrink-0">overdue</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        {/* Recent pages — left 3 columns */}
        <div className="col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-[#4a4a55]" />
              <span className="text-xs font-semibold text-[#6b6b75] uppercase tracking-wider">Recent pages</span>
            </div>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="text-xs text-[#4a4a55] hover:text-[#7c6af7] transition-colors flex items-center gap-1"
            >
              All pages <ArrowRight size={11} />
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="bg-[#141416] border border-[#1e1e22] rounded-2xl p-8 text-center">
              <p className="text-sm text-[#4a4a55]">No pages yet — create one above.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recent.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => router.push(`/docs/${doc.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#141416] border border-[#1e1e22] hover:border-[#2a2a2e] hover:bg-[#1a1a1d] transition-colors text-left group"
                >
                  <FileText size={14} className="text-[#4a4a55] flex-shrink-0 group-hover:text-[#7c6af7] transition-colors" />
                  <span className="flex-1 text-sm text-[#a0a0aa] truncate group-hover:text-[#e8e8ed] transition-colors">
                    {doc.title || 'Untitled'}
                  </span>
                  {doc.is_starred && <Star size={11} className="text-[#f5a623] fill-[#f5a623] flex-shrink-0" />}
                  <span className="text-xs text-[#3a3a3f] flex-shrink-0">{relativeTime(doc.updated_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar — starred + templates */}
        <div className="col-span-2 space-y-6">

          {/* Starred */}
          {starred.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star size={13} className="text-[#f5a623]" />
                <span className="text-xs font-semibold text-[#6b6b75] uppercase tracking-wider">Starred</span>
              </div>
              <div className="space-y-1">
                {starred.slice(0, 5).map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => router.push(`/docs/${doc.id}`)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#141416] border border-[#1e1e22] hover:border-[#f5a623]/20 hover:bg-[#1a1a1d] transition-colors text-left group"
                  >
                    <span className="flex-1 text-xs text-[#a0a0aa] truncate group-hover:text-[#e8e8ed] transition-colors">
                      {doc.title || 'Untitled'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Templates */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LayoutTemplate size={13} className="text-[#4a4a55]" />
              <span className="text-xs font-semibold text-[#6b6b75] uppercase tracking-wider">Templates</span>
            </div>
            <div className="space-y-1">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateCreate(t.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#141416] border border-[#1e1e22] hover:border-[#7c6af7]/20 hover:bg-[#1a1a1d] transition-colors text-left group"
                >
                  <span className="text-sm">{t.icon}</span>
                  <span className="flex-1 text-xs text-[#a0a0aa] truncate group-hover:text-[#e8e8ed] transition-colors">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
