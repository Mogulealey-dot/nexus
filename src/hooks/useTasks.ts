'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Task } from '@/types'

export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  const fetchTasks = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false })
    setTasks((data as Task[]) || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const createTask = useCallback(async (title: string, dueDate?: string, priority?: Task['priority'], docId?: string) => {
    if (!userId) return null
    const { data } = await supabase
      .from('tasks')
      .insert({ user_id: userId, title, due_date: dueDate || null, priority: priority || 'normal', doc_id: docId || null })
      .select('*')
      .single()
    await fetchTasks()
    return data as Task | null
  }, [userId, supabase, fetchTasks])

  const updateTask = useCallback(async (id: string, updates: Partial<Pick<Task, 'title' | 'completed' | 'due_date' | 'priority'>>) => {
    await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [supabase])

  const toggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    await updateTask(id, { completed: !task.completed })
  }, [tasks, updateTask])

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [supabase])

  // Stable date strings — recomputed once per render cycle, not per filter call
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const tomorrow = useMemo(() => new Date(Date.now() + 86400000).toISOString().split('T')[0], [])

  // Memoize all derived lists so they only recompute when tasks or today changes
  const { todayTasks, upcomingTasks, overdueTasks, completedTasks, noDateTasks } = useMemo(() => ({
    todayTasks:    tasks.filter(t => !t.completed && t.due_date === today),
    upcomingTasks: tasks.filter(t => !t.completed && t.due_date && t.due_date > today),
    overdueTasks:  tasks.filter(t => !t.completed && t.due_date && t.due_date < today),
    completedTasks: tasks.filter(t => t.completed),
    noDateTasks:   tasks.filter(t => !t.completed && !t.due_date),
  }), [tasks, today])

  return {
    tasks, loading, today, tomorrow,
    todayTasks, upcomingTasks, overdueTasks, completedTasks, noDateTasks,
    createTask, updateTask, toggleTask, deleteTask, refetch: fetchTasks,
  }
}
