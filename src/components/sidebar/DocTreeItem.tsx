'use client'
import { useState } from 'react'
import { ChevronRight, FileText, Plus, Trash2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocMeta } from '@/types'

interface Props {
  doc: DocMeta
  activeDocId: string | null
  depth: number
  onNavigate: (id: string) => void
  onCreateChild: (parentId: string) => void
  onArchive: (id: string) => void
  onRename: (id: string, title: string) => void
}

export default function DocTreeItem({ doc, activeDocId, depth, onNavigate, onCreateChild, onArchive, onRename }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(doc.title)
  const hasChildren = (doc.children?.length || 0) > 0
  const isActive = activeDocId === doc.id

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer text-sm transition-colors relative',
          isActive ? 'bg-[#7c6af7]/15 text-[#e8e8ed]' : 'text-[#8a8a94] hover:bg-[#1e1e22] hover:text-[#e8e8ed]'
        )}
        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
        onClick={() => onNavigate(doc.id)}
      >
        {/* Expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
          className={cn('w-4 h-4 flex items-center justify-center flex-shrink-0 transition-transform', expanded ? 'rotate-90' : '', !hasChildren && 'opacity-0 pointer-events-none')}
        >
          <ChevronRight size={12} />
        </button>

        <FileText size={13} className="flex-shrink-0 opacity-60" />

        {editing ? (
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm text-[#e8e8ed]"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={() => { onRename(doc.id, editVal || 'Untitled'); setEditing(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { onRename(doc.id, editVal || 'Untitled'); setEditing(false) } }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate">{doc.title || 'Untitled'}</span>
        )}

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-auto" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onCreateChild(doc.id)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#2a2a2e] text-[#6b6b75] hover:text-[#e8e8ed]"
            title="Add sub-page"
          ><Plus size={11} /></button>
          <button
            onClick={() => setShowMenu(m => !m)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#2a2a2e] text-[#6b6b75] hover:text-[#e8e8ed]"
          ><MoreHorizontal size={11} /></button>
        </div>

        {showMenu && (
          <div className="absolute right-2 top-full z-50 mt-1 bg-[#1a1a1d] border border-[#2a2a2e] rounded-lg shadow-xl py-1 w-36">
            <button className="w-full px-3 py-1.5 text-left text-xs text-[#a0a0aa] hover:bg-[#2a2a2e] hover:text-[#e8e8ed] flex items-center gap-2"
              onClick={() => { setEditing(true); setShowMenu(false) }}>
              Rename
            </button>
            <button className="w-full px-3 py-1.5 text-left text-xs text-[#f56565] hover:bg-[#2a2a2e] flex items-center gap-2"
              onClick={() => { onArchive(doc.id); setShowMenu(false) }}>
              <Trash2 size={11} /> Delete
            </button>
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {doc.children!.map(child => (
            <DocTreeItem key={child.id} doc={child} activeDocId={activeDocId} depth={depth + 1}
              onNavigate={onNavigate} onCreateChild={onCreateChild} onArchive={onArchive} onRename={onRename} />
          ))}
        </div>
      )}
    </div>
  )
}
