import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance } from 'tippy.js'
import PageLinkMenu from '../PageLinkMenu'
import type { Editor } from '@tiptap/core'

// Module-level docs list updated by the React component
let pagesList: { id: string; title: string }[] = []
export function updatePagesList(docs: { id: string; title: string }[]) {
  pagesList = docs
}

export const PageLinkExtension = Extension.create({
  name: 'pageLink',
  addOptions() {
    return {
      suggestion: {
        char: '@',
        command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: { id: string; title: string } }) => {
          editor.chain().focus().deleteRange(range).insertContent(
            `<a href="/docs/${props.id}">${props.title}</a>`
          ).run()
        },
      } as Partial<SuggestionOptions>,
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase()
          return pagesList
            .filter(p => p.title.toLowerCase().includes(q))
            .slice(0, 8)
        },
        render: () => {
          let component: ReactRenderer
          let popup: Instance[]
          return {
            onStart: (props) => {
              component = new ReactRenderer(PageLinkMenu, { props, editor: props.editor })
              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'nexus',
              })
            },
            onUpdate: (props) => {
              component?.updateProps(props)
              popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') { popup?.[0]?.hide(); return true }
              return (component?.ref as { onKeyDown?: (e: { event: KeyboardEvent }) => boolean })?.onKeyDown?.(props) ?? false
            },
            onExit: () => {
              popup?.[0]?.destroy()
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})
