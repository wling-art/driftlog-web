import { create } from "zustand"

// 跨组件的界面状态：搜索面板开关、在线人数
type UI = {
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  online: number
  setOnline: (n: number) => void
}

export const useUI = create<UI>((set) => ({
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  online: 0,
  setOnline: (online) => set({ online }),
}))
