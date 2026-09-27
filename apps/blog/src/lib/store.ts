import { create } from "zustand"

/** 任务栏路径上的一段：点了去哪（最后一段是当前页，不用 to） */
export type Crumb = { label: string; to?: string; search?: Record<string, string> }

// 跨组件的界面状态：搜索面板、在线人数、评论窗口、任务栏路径
type UI = {
  /** 页面告诉任务栏「我在哪」：文章 / 分类 / 标题。没写就按地址猜 */
  crumbs: Crumb[] | null
  setCrumbs: (c: Crumb[] | null) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  online: number
  setOnline: (n: number) => void
  /** 当前页面有评论可看时（文章 / 手记 / 页面），任务栏上才出现「评论」 */
  comments: { entryId: number; title: string } | null
  setComments: (c: UI["comments"]) => void
  commentsOpen: boolean
  setCommentsOpen: (open: boolean) => void
  /** 账号窗口（登录 / 注册 / 退出），从开始菜单打开 */
  accountOpen: boolean
  setAccountOpen: (open: boolean) => void
}

export const useUI = create<UI>((set) => ({
  crumbs: null,
  setCrumbs: (crumbs) => set({ crumbs }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  online: 0,
  setOnline: (online) => set({ online }),
  comments: null,
  setComments: (comments) => set(comments ? { comments } : { comments: null, commentsOpen: false }),
  commentsOpen: false,
  setCommentsOpen: (commentsOpen) => set({ commentsOpen }),
  accountOpen: false,
  setAccountOpen: (accountOpen) => set({ accountOpen }),
}))
