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
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  chatOpen: false,
  shortcutsOpen: false,
  activeDocId: null,
  pendingTemplate: null,
  graphOpen: false,
  pendingImport: null,
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
}))
