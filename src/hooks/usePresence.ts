'use client'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'

export interface PresenceUser {
  userId: string
  displayName: string
  avatarColor: string
}

// Deterministic color from userId so the same user always gets the same color
const AVATAR_COLORS = ['#7c6af7', '#34c972', '#f5a623', '#f56565', '#4fd1c5', '#a78bfa', '#fb923c']
function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/**
 * Tracks which authenticated users are currently viewing/editing a document.
 * Uses Supabase Realtime Presence — no extra packages required.
 *
 * Returns `activeUsers`: list of users currently in the doc (excluding the current user).
 */
export function usePresence(
  docId: string | null,
  user: { id: string; email?: string | null } | null
) {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([])
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!docId || !user) return

    const myPresence: PresenceUser = {
      userId: user.id,
      displayName: user.email?.split('@')[0] ?? 'Anonymous',
      avatarColor: colorForUser(user.id),
    }

    const channel = supabase.channel(`doc-presence:${docId}`, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        // Flatten presence state — each key maps to an array (handles multi-tab)
        const others: PresenceUser[] = []
        for (const [key, presences] of Object.entries(state)) {
          if (key === user.id) continue // exclude self
          const p = presences[0] as unknown as PresenceUser
          if (p) others.push(p)
        }
        setActiveUsers(others)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(myPresence)
        }
      })

    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel))
    }
  }, [docId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { activeUsers }
}
