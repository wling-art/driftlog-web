import { create } from "zustand"

/** 任务栏路径的一段；最后一段是当前页，不带 to */
export type Crumb = { label: string; to?: string; search?: Record<string, string> }

// 跨组件的界面状态
type UI = {
  /** 页面给的任务栏路径；null 时按地址推断 */
  crumbs: Crumb[] | null
  setCrumbs: (c: Crumb[] | null) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  online: number
  /** 在线的人所在的页面：路径 → 人数 */
  onlinePages: Record<string, number>
  setOnline: (n: number, pages: Record<string, number>) => void
  /** 当前页的评论对象；非 null 时任务栏显示「评论」 */
  comments: { entryId: number; title: string } | null
  setComments: (c: UI["comments"]) => void
  commentsOpen: boolean
  setCommentsOpen: (open: boolean) => void
  accountOpen: boolean
  setAccountOpen: (open: boolean) => void
}

export const useUI = create<UI>((set) => ({
  crumbs: null,
  setCrumbs: (crumbs) => set({ crumbs }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  online: 0,
  onlinePages: {},
  setOnline: (online, onlinePages) => set({ online, onlinePages }),
  comments: null,
  setComments: (comments) => set(comments ? { comments } : { comments: null, commentsOpen: false }),
  commentsOpen: false,
  setCommentsOpen: (commentsOpen) => set({ commentsOpen }),
  accountOpen: false,
  setAccountOpen: (accountOpen) => set({ accountOpen }),
}))
