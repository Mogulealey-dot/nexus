'use client'
import { create } from 'zustand'

interface AppStore {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  activeDocId: string | null
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveDocId: (id: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  activeDocId: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveDocId: (id) => set({ activeDocId: id }),
}))
