export interface Doc {
  id: string
  user_id: string
  title: string
  parent_id: string | null
  content: Uint8Array | null
  icon: string | null
  is_archived: boolean
  is_starred: boolean
  tags: string[]
  position?: number | null
  is_public?: boolean
  public_slug?: string | null
  created_at: string
  updated_at: string
}

export interface DocMeta extends Omit<Doc, 'content'> {
  children?: DocMeta[]
}

export interface PendingImport {
  docId: string
  html: string
  title: string
}

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (editor: unknown) => void
  keywords: string[]
}

export interface Task {
  id: string
  user_id: string
  doc_id: string | null
  title: string
  completed: boolean
  due_date: string | null
  priority: 'low' | 'normal' | 'high'
  created_at: string
  updated_at: string
}

export interface CommandPaletteItem {
  id: string
  label: string
  description?: string
  icon?: string
  group: 'docs' | 'actions' | 'ai'
  action: () => void
}
