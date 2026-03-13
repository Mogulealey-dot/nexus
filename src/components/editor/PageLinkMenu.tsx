'use client'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Page { id: string; title: string }
interface Props { items: Page[]; command: (item: Page) => void }

const PageLinkMenu = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, Props>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0)
    useEffect(() => setSelected(0), [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') { setSelected(s => (s - 1 + items.length) % items.length); return true }
        if (event.key === 'ArrowDown') { setSelected(s => (s + 1) % items.length); return true }
        if (event.key === 'Enter') { command(items[selected]); return true }
        return false
      },
    }))

    if (!items.length) return (
      <div className="bg-[#1a1a1d] border border-[#2a2a2e] rounded-xl shadow-2xl w-56 py-2 px-3 text-xs text-[#4a4a55]">
        No pages found
      </div>
    )

    return (
      <div className="bg-[#1a1a1d] border border-[#2a2a2e] rounded-xl shadow-2xl overflow-hidden w-56 py-1.5">
        <div className="px-3 py-1 text-[10px] text-[#4a4a55] font-semibold uppercase tracking-wider">Link to page</div>
        {items.map((page, i) => (
          <button
            key={page.id}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
              i === selected ? 'bg-[#2a2a2e]' : 'hover:bg-[#222225]'
            )}
            onMouseEnter={() => setSelected(i)}
            onClick={() => command(page)}
          >
            <FileText size={13} className="text-[#7c6af7] flex-shrink-0" />
            <span className="text-sm text-[#e8e8ed] truncate">{page.title || 'Untitled'}</span>
          </button>
        ))}
      </div>
    )
  }
)
PageLinkMenu.displayName = 'PageLinkMenu'
export default PageLinkMenu
