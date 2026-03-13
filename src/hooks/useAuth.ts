'use client'
import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase/client'

export function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const supabase = getSupabaseClient()

  useEffect(() => {
    supabase.auth.getUser().then((res: { data: { user: User | null } }) => setUser(res.data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const signInWithEmail = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUpWithEmail = (email: string, password: string) =>
    supabase.auth.signUp({ email, password })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/callback` } })

  const signOut = () => supabase.auth.signOut()

  return { user, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }
}
