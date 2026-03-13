'use client'
import { useState } from 'react'
import { Plus, Check, Trash2, Calendar, Flag, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'
import type { DocMeta } from '@/types'

interface Props {
  tasks: Task[]
  todayTasks: Task[]
  upcomingTasks: Task[]
  overdueTasks: Task[]
  completedTasks: Task[]
  noDateTasks: Task[]
  docs: DocMeta[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onCreate: (title: string, dueDate?: string, priority?: Task['priority']) => void
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'completed' | 'due_date' | 'priority'>>) => void
}

type Filter = 'today' | 'upcoming' | 'all' | 'completed'

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  high: 'text-[#f56565]',
  normal: 'text-[#7c6af7]',
  low: 'text-[#4a4a55]',
}

const PRIORITY_BG: Record<Task['priority'], string> = {
  high: 'bg-[#f56565]/10 border-[#f56565]/20 text-[#f56565]',
  normal: 'bg-[#7c6af7]/10 border-[#7c6af7]/20 text-[#7c6af7]',
  low: 'bg-[#2a2a2e] border-[#2a2a2e] text-[#4a4a55]',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (dateStr === today) return { label: 'Today', color: 'text-[#34c972]' }
  if (dateStr === tomorrow) return { label: 'Tomorrow', color: 'text-[#f5a623]' }
  if (dateStr < today) return { label: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-[#f56565]' }
  return { label: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-[#6b6b75]' }
}

function TaskRow({ task, onToggle, onDelete, onUpdate }: {
  task: Task
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'completed' | 'due_date' | 'priority'>>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(task.title)
  const dateInfo = formatDate(task.due_date)

  return (
    <div className={cn(
      'group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
      task.completed
        ? 'bg-[#0d0d0f] border-[#1a1a1d] opacity-50'
        : 'bg-[#141416] border-[#1e1e22] hover:border-[#2a2a2e]'
    )}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id)}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
          task.completed
            ? 'bg-[#34c972] border-[#34c972]'
            : `border-current ${PRIORITY_COLORS[task.priority]} hover:opacity-70`
        )}
      >
        {task.completed && <Check size={11} className="text-white" />}
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            className="w-full bg-transparent outline-none text-sm text-[#e8e8ed]"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={() => { onUpdate(task.id, { title: editVal || task.title }); setEditing(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onUpdate(task.id, { title: editVal || task.title }); setEditing(false) }
              if (e.key === 'Escape') { setEditVal(task.title); setEditing(false) }
            }}
          />
        ) : (
          <span
            onClick={() => !task.completed && setEditing(true)}
            className={cn('text-sm cursor-text truncate block', task.completed ? 'line-through text-[#4a4a55]' : 'text-[#e8e8ed]')}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Priority badge */}
      {task.priority !== 'normal' && (
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0', PRIORITY_BG[task.priority])}>
          {task.priority}
        </span>
      )}

      {/* Due date */}
      {dateInfo && (
        <span className={cn('text-xs flex-shrink-0 flex items-center gap-1', dateInfo.color)}>
          <Calendar size={11} />
          {dateInfo.label}
        </span>
      )}

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0 transition-opacity">
        <select
          value={task.due_date || ''}
          onChange={e => onUpdate(task.id, { due_date: e.target.value || null })}
          className="text-[10px] bg-[#1e1e22] border border-[#2a2a2e] text-[#6b6b75] rounded px-1 py-0.5 outline-none cursor-pointer"
        >
          <option value="">No date</option>
          <option value={new Date().toISOString().split('T')[0]}>Today</option>
          <option value={new Date(Date.now() + 86400000).toISOString().split('T')[0]}>Tomorrow</option>
          {task.due_date && !['', new Date().toISOString().split('T')[0], new Date(Date.now() + 86400000).toISOString().split('T')[0]].includes(task.due_date) && (
            <option value={task.due_date}>{formatDate(task.due_date)?.label}</option>
          )}
        </select>
        <button
          onClick={() => onDelete(task.id)}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#3a3a3f] hover:text-[#f56565] hover:bg-[#f56565]/10 transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function Section({ title, tasks, color, onToggle, onDelete, onUpdate }: {
  title: string; tasks: Task[]; color?: string
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'completed' | 'due_date' | 'priority'>>) => void
}) {
  if (tasks.length === 0) return null
  return (
    <div className="mb-6">
      <div className={cn('text-xs font-semibold uppercase tracking-wider mb-2 px-1', color || 'text-[#6b6b75]')}>
        {title} <span className="font-normal opacity-60">({tasks.length})</span>
      </div>
      <div className="space-y-1.5">
        {tasks.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} />)}
      </div>
    </div>
  )
}

export default function TasksView({ tasks, todayTasks, upcomingTasks, overdueTasks, completedTasks, noDateTasks, onToggle, onDelete, onCreate, onUpdate }: Props) {
  const [filter, setFilter] = useState<Filter>('today')
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newPriority, setNewPriority] = useState<Task['priority']>('normal')
  const [showForm, setShowForm] = useState(false)

  const handleCreate = () => {
    if (!newTitle.trim()) return
    onCreate(newTitle.trim(), newDate || undefined, newPriority)
    setNewTitle(''); setNewDate(''); setNewPriority('normal'); setShowForm(false)
  }

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: 'today', label: 'Today', count: todayTasks.length + overdueTasks.length },
    { id: 'upcoming', label: 'Upcoming', count: upcomingTasks.length },
    { id: 'all', label: 'All', count: tasks.filter(t => !t.completed).length },
    { id: 'completed', label: 'Done', count: completedTasks.length },
  ]

  const sharedProps = { onToggle, onDelete, onUpdate }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8e8ed]">Tasks</h1>
          <p className="text-sm text-[#4a4a55] mt-0.5">
            {tasks.filter(t => !t.completed).length} remaining · {completedTasks.length} completed
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 bg-[#7c6af7] hover:bg-[#9080ff] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={15} /> New Task
        </button>
      </div>

      {/* New task form */}
      {showForm && (
        <div className="bg-[#141416] border border-[#7c6af7]/30 rounded-2xl p-4 mb-6 space-y-3">
          <input
            autoFocus
            className="w-full bg-transparent outline-none text-sm text-[#e8e8ed] placeholder-[#3a3a3f]"
            placeholder="Task title…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false) }}
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[#4a4a55]">
              <Calendar size={13} />
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="bg-[#1e1e22] border border-[#2a2a2e] rounded-lg px-2 py-1 text-xs text-[#a0a0aa] outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[#4a4a55]">
              <Flag size={13} />
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as Task['priority'])}
                className="bg-[#1e1e22] border border-[#2a2a2e] rounded-lg px-2 py-1 text-xs text-[#a0a0aa] outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowForm(false)} className="text-xs text-[#4a4a55] hover:text-[#6b6b75] px-2 py-1">Cancel</button>
              <button onClick={handleCreate} disabled={!newTitle.trim()} className="text-xs bg-[#7c6af7] text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#9080ff] transition-colors">
                Add task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 bg-[#141416] border border-[#1e1e22] rounded-xl p-1">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === f.id ? 'bg-[#7c6af7] text-white' : 'text-[#6b6b75] hover:text-[#a0a0aa]'
            )}
          >
            {f.label}
            {f.count > 0 && (
              <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 font-semibold',
                filter === f.id ? 'bg-white/20' : 'bg-[#1e1e22]'
              )}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Task lists */}
      {filter === 'today' && (
        <>
          <Section title="Overdue" tasks={overdueTasks} color="text-[#f56565]" {...sharedProps} />
          <Section title="Today" tasks={todayTasks} color="text-[#34c972]" {...sharedProps} />
          {todayTasks.length === 0 && overdueTasks.length === 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
                <Check size={20} className="text-[#34c972]" />
              </div>
              <p className="text-sm text-[#4a4a55]">All caught up for today!</p>
            </div>
          )}
        </>
      )}
      {filter === 'upcoming' && (
        <>
          <Section title="Upcoming" tasks={upcomingTasks} color="text-[#7c6af7]" {...sharedProps} />
          <Section title="No date" tasks={noDateTasks} color="text-[#4a4a55]" {...sharedProps} />
          {upcomingTasks.length === 0 && noDateTasks.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-[#4a4a55]">No upcoming tasks.</p>
            </div>
          )}
        </>
      )}
      {filter === 'all' && (
        <>
          <Section title="Overdue" tasks={overdueTasks} color="text-[#f56565]" {...sharedProps} />
          <Section title="Today" tasks={todayTasks} color="text-[#34c972]" {...sharedProps} />
          <Section title="Upcoming" tasks={upcomingTasks} color="text-[#7c6af7]" {...sharedProps} />
          <Section title="No date" tasks={noDateTasks} color="text-[#4a4a55]" {...sharedProps} />
          {tasks.filter(t => !t.completed).length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-[#4a4a55]">No tasks yet. Create one above.</p>
            </div>
          )}
        </>
      )}
      {filter === 'completed' && (
        <>
          <Section title="Completed" tasks={completedTasks} color="text-[#34c972]" {...sharedProps} />
          {completedTasks.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-[#4a4a55]">No completed tasks yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
