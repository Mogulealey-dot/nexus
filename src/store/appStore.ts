'use client'
import { create } from 'zustand'
import type { PendingImport } from '@/types'

interface AppStore {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  chatOpen: boolean
  shortcutsOpen: boolean
  activeDocId: string | null
  pendingTemplate: string | null
  graphOpen: boolean
  pendingImport: PendingImport | null
  // Nav history
  navHistory: string[]
  navIndex: number
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setChatOpen: (open: boolean) => void
  toggleChat: () => void
  setShortcutsOpen: (open: boolean) => void
  toggleShortcuts: () => void
  setActiveDocId: (id: string | null) => void
  setPendingTemplate: (id: string | null) => void
  setGraphOpen: (v: boolean) => void
  setPendingImport: (v: PendingImport | null) => void
  pushNav: (docId: string) => void
  navBack: () => string | null
  navForward: () => string | null
}

export const useAppStore = create<AppStore>((set, get) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  chatOpen: false,
  shortcutsOpen: false,
  activeDocId: null,
  pendingTemplate: null,
  graphOpen: false,
  pendingImport: null,
  navHistory: [],
  navIndex: -1,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setChatOpen: (open) => set({ chatOpen: open }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
  setActiveDocId: (id) => set({ activeDocId: id }),
  setPendingTemplate: (id) => set({ pendingTemplate: id }),
  setGraphOpen: (v) => set({ graphOpen: v }),
  setPendingImport: (v) => set({ pendingImport: v }),
  pushNav: (docId) => set((s) => {
    // Don't push if same as current
    if (s.navHistory[s.navIndex] === docId) return s
    // Truncate forward history then push
    const newHistory = [...s.navHistory.slice(0, s.navIndex + 1), docId]
    return { navHistory: newHistory, navIndex: newHistory.length - 1 }
  }),
  navBack: () => {
    const { navHistory, navIndex } = get()
    if (navIndex <= 0) return null
    const newIndex = navIndex - 1
    set({ navIndex: newIndex })
    return navHistory[newIndex]
  },
  navForward: () => {
    const { navHistory, navIndex } = get()
    if (navIndex >= navHistory.length - 1) return null
    const newIndex = navIndex + 1
    set({ navIndex: newIndex })
    return navHistory[newIndex]
  },
}))
