import { create } from "zustand"

// 跨组件的界面状态：搜索面板、在线人数、评论窗口
type UI = {
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
