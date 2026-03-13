'use client'
export const dynamic = 'force-dynamic'
import { useAuth } from '@/hooks/useAuth'
import { useDocs } from '@/hooks/useDocs'
import { useTasks } from '@/hooks/useTasks'
import TasksView from '@/components/tasks/TasksView'

export default function TasksPage() {
  const { user } = useAuth()
  const { docs } = useDocs(user?.id)
  const { tasks, todayTasks, upcomingTasks, overdueTasks, completedTasks, noDateTasks, createTask, toggleTask, deleteTask, updateTask } = useTasks(user?.id)

  if (!user) return null

  return (
    <TasksView
      tasks={tasks}
      todayTasks={todayTasks}
      upcomingTasks={upcomingTasks}
      overdueTasks={overdueTasks}
      completedTasks={completedTasks}
      noDateTasks={noDateTasks}
      docs={docs}
      onToggle={toggleTask}
      onDelete={deleteTask}
      onCreate={createTask}
      onUpdate={updateTask}
    />
  )
}
