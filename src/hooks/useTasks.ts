'use client'
import { useState, useEffect, useCallback } from 'react'
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

  const createTask = async (title: string, dueDate?: string, priority?: Task['priority'], docId?: string) => {
    if (!userId) return null
    const { data } = await supabase
      .from('tasks')
      .insert({ user_id: userId, title, due_date: dueDate || null, priority: priority || 'normal', doc_id: docId || null })
      .select('*')
      .single()
    await fetchTasks()
    return data as Task | null
  }

  const updateTask = async (id: string, updates: Partial<Pick<Task, 'title' | 'completed' | 'due_date' | 'priority'>>) => {
    await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    await updateTask(id, { completed: !task.completed })
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const todayTasks = tasks.filter(t => !t.completed && t.due_date === today)
  const upcomingTasks = tasks.filter(t => !t.completed && t.due_date && t.due_date > today)
  const overdueTasks = tasks.filter(t => !t.completed && t.due_date && t.due_date < today)
  const completedTasks = tasks.filter(t => t.completed)
  const noDateTasks = tasks.filter(t => !t.completed && !t.due_date)

  return {
    tasks, loading, today, tomorrow,
    todayTasks, upcomingTasks, overdueTasks, completedTasks, noDateTasks,
    createTask, updateTask, toggleTask, deleteTask, refetch: fetchTasks,
  }
}
