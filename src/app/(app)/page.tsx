'use client'
export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'
import { useDocs } from '@/hooks/useDocs'
import { useAuth } from '@/hooks/useAuth'
import HomeDashboard from '@/components/dashboard/HomeDashboard'

export default function HomePage() {
  const { user } = useAuth()
  const { docs, starred, recent, createDoc } = useDocs(user?.id)
  const router = useRouter()

  if (!user) return null

  const handleCreate = async (parentId?: string) => {
    const id = await createDoc(parentId)
    if (id) router.push(`/docs/${id}`)
    return id ?? null
  }

  return (
    <HomeDashboard
      user={user}
      docs={docs}
      starred={starred}
      recent={recent}
      onCreateDoc={handleCreate}
    />
  )
}
