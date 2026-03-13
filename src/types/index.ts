export interface Doc {
  id: string
  user_id: string
  title: string
  parent_id: string | null
  content: Uint8Array | null
  icon: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface DocMeta extends Omit<Doc, 'content'> {
  children?: DocMeta[]
}

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (editor: unknown) => void
  keywords: string[]
}

export interface CommandPaletteItem {
  id: string
  label: string
  description?: string
  icon?: string
  group: 'docs' | 'actions' | 'ai'
  action: () => void
}
