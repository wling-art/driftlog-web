export const site = {
  url: (import.meta.env.VITE_SITE_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  api: (import.meta.env.VITE_API_URL ?? "http://localhost:3900").replace(/\/$/, ""),
  name: import.meta.env.VITE_SITE_NAME ?? "Driftlog",
  description: import.meta.env.VITE_SITE_DESCRIPTION ?? "一个无聊的博客",
  author: import.meta.env.VITE_AUTHOR ?? "wling",
}

export type EntryType = "post" | "note" | "page"
/** 前台地址：文章 /posts/x，手记 /notes/x，页面 /x */
export const entryPath = (type: EntryType, slug: string) =>
  type === "page" ? `/${slug}` : `/${type}s/${slug}`
export const readingMinutes = (html: string) =>
  Math.max(1, Math.round(html.replace(/<[^>]+>/g, "").length / 400))
export const formatDate = (d: string | Date | null | undefined) =>
  d
    ? new Date(d)
        .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
        .replaceAll("/", "-")
    : ""

/** 一眼能懂的时间：刚刚 / 5 分钟前 / 3 小时前 / 昨天 14:20 / 9月27日 / 2025年9月27日 */
export function timeAgo(d: string | Date, now = Date.now()) {
  const t = new Date(d)
  const diff = (now - t.getTime()) / 1000
  const hm = t.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
  if (diff < 60) return "刚刚"
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  const today = new Date(now)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (t.getTime() >= startOfToday) return `${Math.floor(diff / 3600)} 小时前`
  if (t.getTime() >= startOfToday - 86400_000) return `昨天 ${hm}`
  if (t.getFullYear() === today.getFullYear()) return `${t.getMonth() + 1}月${t.getDate()}日`
  return `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日`
}
/** 悬停时看的完整时间 */
export const fullTime = (d: string | Date) =>
  new Date(d).toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
