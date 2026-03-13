import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance } from 'tippy.js'
import SlashCommandMenu from '../SlashCommandMenu'
import type { Editor } from '@tiptap/core'

export const SLASH_COMMANDS = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    icon: '¶',
    keywords: ['text', 'paragraph', 'p'],
    command: (editor: Editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    keywords: ['h1', 'heading', 'title'],
    command: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    keywords: ['h2', 'heading', 'subtitle'],
    command: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    keywords: ['h3', 'heading'],
    command: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list of items',
    icon: '•',
    keywords: ['bullet', 'list', 'ul', 'unordered'],
    command: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list of items',
    icon: '1.',
    keywords: ['numbered', 'ordered', 'ol', 'list'],
    command: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Task List',
    description: 'Checkbox to-do list',
    icon: '☑',
    keywords: ['todo', 'task', 'checkbox', 'check'],
    command: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: '</>',
    keywords: ['code', 'codeblock', 'pre'],
    command: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Quote',
    description: 'Blockquote / callout',
    icon: '"',
    keywords: ['quote', 'blockquote', 'callout'],
    command: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule separator',
    icon: '—',
    keywords: ['divider', 'hr', 'rule', 'separator'],
    command: (editor: Editor) => editor.chain().focus().setHorizontalRule().run(),
  },
]

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: { command: (editor: Editor) => void } }) => {
          editor.chain().focus().deleteRange(range).run()
          props.command(editor)
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
          return SLASH_COMMANDS.filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.keywords.some(k => k.includes(query.toLowerCase()))
          ).slice(0, 8)
        },
        render: () => {
          let component: ReactRenderer
          let popup: Instance[]

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, { props, editor: props.editor })
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
