'use client'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { cn } from '@/lib/utils'

interface Item {
  title: string
  description: string
  icon: string
  command: (editor: unknown) => void
}

interface Props {
  items: Item[]
  command: (item: Item) => void
}

const SlashCommandMenu = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, Props>(
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

    if (!items.length) return null

    return (
      <div className="slash-menu bg-[#1a1a1d] border border-[#2a2a2e] rounded-xl shadow-2xl overflow-hidden w-64 py-1.5">
        {items.map((item, i) => (
          <button
            key={item.title}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
              i === selected ? 'bg-[#2a2a2e]' : 'hover:bg-[#222225]'
            )}
            onMouseEnter={() => setSelected(i)}
            onClick={() => command(item)}
          >
            <span className="w-7 h-7 flex items-center justify-center rounded-md bg-[#2a2a2e] text-xs font-mono text-[#7c6af7] flex-shrink-0">
              {item.icon}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#e8e8ed]">{item.title}</div>
              <div className="text-xs text-[#6b6b75] truncate">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    )
  }
)

SlashCommandMenu.displayName = 'SlashCommandMenu'
export default SlashCommandMenu
