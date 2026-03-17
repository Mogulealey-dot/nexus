'use client'
import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, RefreshCw, MapPin, ExternalLink, AlertCircle, ChevronRight } from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location: string | null
  description: string | null
  htmlLink: string | null
  color: string | null
}

interface ApiResponse {
  connected: boolean
  insufficientScopes?: boolean
  events?: CalendarEvent[]
  error?: string
}

const COLOR_MAP: Record<string, string> = {
  '1': 'bg-[#4a90d9]', '2': 'bg-[#34c972]', '3': 'bg-[#9b59b6]',
  '4': 'bg-[#f56565]', '5': 'bg-[#f5a623]', '6': 'bg-[#4a90d9]',
  '7': 'bg-[#34c972]', '8': 'bg-[#6b6b75]', '9': 'bg-[#4a90d9]',
  '10': 'bg-[#34c972]', '11': 'bg-[#f56565]',
}

function formatEventDate(dateStr: string, allDay: boolean) {
  if (!dateStr) return ''
  const d = allDay ? new Date(dateStr + 'T00:00:00') : new Date(dateStr)
  if (allDay) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getDayLabel(dateStr: string) {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86400000)
  if (d.toDateString() === today.toDateString()) return { label: 'Today', color: 'text-[#34c972]' }
  if (d.toDateString() === tomorrow.toDateString()) return { label: 'Tomorrow', color: 'text-[#f5a623]' }
  return {
    label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    color: 'text-[#a0a0aa]'
  }
}

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const key = (e.start || '').split('T')[0]
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return map
}

export default function CalendarPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/google/calendar')
      setData(await res.json())
    } catch {
      setData({ connected: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center animate-pulse">
            <CalendarDays size={20} className="text-[#7c6af7]" />
          </div>
          <p className="text-sm text-[#4a4a55]">Loading calendar…</p>
        </div>
      </div>
    )
  }

  if (!data?.connected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={28} className="text-[#7c6af7]" />
          </div>
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Connect Google Calendar</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Connect your Google account via Gmail to also access Calendar events.
          </p>
          <a
            href="/api/gmail/auth"
            className="inline-flex items-center gap-2 bg-[#7c6af7] hover:bg-[#9080ff] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <CalendarDays size={15} />
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
          <h2 className="text-lg font-semibold text-[#e8e8ed] mb-2">Calendar Access Required</h2>
          <p className="text-sm text-[#4a4a55] mb-6 max-w-xs mx-auto">
            Your existing Google connection doesn't include Calendar access. Please reconnect to grant Calendar permissions.
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

  const events = data.events || []
  const grouped = groupByDay(events)
  const days = Array.from(grouped.keys()).sort()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8e8ed]">Calendar</h1>
          <p className="text-sm text-[#4a4a55] mt-0.5">
            {events.length} upcoming event{events.length !== 1 ? 's' : ''} · next 14 days
          </p>
        </div>
        <button
          onClick={fetchEvents}
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

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-[#141416] border border-[#1e1e22] flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={20} className="text-[#34c972]" />
          </div>
          <p className="text-sm text-[#4a4a55]">No upcoming events in the next 14 days.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {days.map(day => {
            const dayEvents = grouped.get(day)!
            const dayInfo = getDayLabel(dayEvents[0].start)
            return (
              <div key={day}>
                <div className={`text-xs font-semibold uppercase tracking-wider mb-3 px-1 ${dayInfo.color}`}>
                  {dayInfo.label}
                </div>
                <div className="space-y-2">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      className="group bg-[#141416] border border-[#1e1e22] hover:border-[#2a2a2e] rounded-xl px-4 py-3 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-1 rounded-full mt-1 flex-shrink-0 self-stretch min-h-[1.25rem] ${COLOR_MAP[event.color || ''] || 'bg-[#7c6af7]'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#e8e8ed] truncate">{event.title}</span>
                            {event.htmlLink && (
                              <a
                                href={event.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover:opacity-100 text-[#4a4a55] hover:text-[#7c6af7] transition-all flex-shrink-0"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-[#6b6b75]">
                              {event.allDay ? 'All day' : `${formatEventDate(event.start, false)} – ${formatEventDate(event.end, false)}`}
                            </span>
                            {event.location && (
                              <span className="text-xs text-[#4a4a55] flex items-center gap-1 truncate">
                                <MapPin size={10} />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-[#2a2a2e] group-hover:text-[#4a4a55] flex-shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
