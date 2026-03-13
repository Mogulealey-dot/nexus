'use client'
import { create } from 'zustand'

interface AppStore {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  activeDocId: string | null
  pendingTemplate: string | null
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveDocId: (id: string | null) => void
  setPendingTemplate: (id: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  activeDocId: null,
  pendingTemplate: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveDocId: (id) => set({ activeDocId: id }),
  setPendingTemplate: (id) => set({ pendingTemplate: id }),
}))
