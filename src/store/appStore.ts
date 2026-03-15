'use client'
import { create } from 'zustand'

interface AppStore {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  chatOpen: boolean
  shortcutsOpen: boolean
  activeDocId: string | null
  pendingTemplate: string | null
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setChatOpen: (open: boolean) => void
  toggleChat: () => void
  setShortcutsOpen: (open: boolean) => void
  toggleShortcuts: () => void
  setActiveDocId: (id: string | null) => void
  setPendingTemplate: (id: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  chatOpen: false,
  shortcutsOpen: false,
  activeDocId: null,
  pendingTemplate: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setChatOpen: (open) => set({ chatOpen: open }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
  setActiveDocId: (id) => set({ activeDocId: id }),
  setPendingTemplate: (id) => set({ pendingTemplate: id }),
}))
