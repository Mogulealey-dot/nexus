'use client'
import { use } from 'react'
import { useAuth } from '@/hooks/useAuth'
import NexusEditor from '@/components/editor/NexusEditor'
import { useDocs } from '@/hooks/useDocs'

export default function DocPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params)
  const { user } = useAuth()
  const { docs, updateIcon } = useDocs(user?.id)
  const doc = docs.find(d => d.id === docId)

  if (!user) return null

  return (
    <NexusEditor
      docId={docId}
      initialTitle={doc?.title || 'Untitled'}
      initialTags={doc?.tags || []}
      initialIcon={doc?.icon || null}
      userId={user.id}
      userEmail={user.email}
      docs={docs}
      onUpdateIcon={(icon) => updateIcon(docId, icon)}
    />
  )
}
