import { useSyncExternalStore } from "react"

// 站点地址和 API 地址；站名等内容用 useSite()
export const site = {
  url: (import.meta.env.VITE_SITE_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  api: (import.meta.env.VITE_API_URL ?? "http://localhost:3900").replace(/\/$/, ""),
  /** Umami 统计：两项都设了才加载 */
  umami:
    import.meta.env.VITE_UMAMI_URL && import.meta.env.VITE_UMAMI_ID
      ? {
          src: `${import.meta.env.VITE_UMAMI_URL.replace(/\/$/, "")}/script.js`,
          id: import.meta.env.VITE_UMAMI_ID as string,
        }
      : null,
}

type SiteInfo = { title: string; description: string; owner: { name: string } }
const fallback: SiteInfo = { title: "Driftlog", description: "", owner: { name: "" } }
/** 在 head() 里取根路由加载的站点设置 */
export const siteOf = (matches: { routeId: string; loaderData?: unknown }[]) =>
  (matches.find((m) => m.routeId === "__root__")?.loaderData as SiteInfo | undefined) ?? fallback

export type EntryType = "post" | "note" | "page"
export const typeLabel: Record<EntryType, string> = { post: "文章", note: "手记", page: "页面" }
/** 前台地址：/posts/x、/notes/x、/x */
export const entryPath = (type: EntryType, slug: string) =>
  type === "page" ? `/${slug}` : `/${type}s/${slug}`
export const readingMinutes = (html: string) =>
  Math.max(1, Math.round(html.replace(/<[^>]+>/g, "").length / 400))

/** 显示日期用的时区 */
const timeZone = "Asia/Shanghai"
/** 日期：2025-09-27 */
export const formatDate = (d: string | Date | null | undefined) =>
  d
    ? new Date(d)
        .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", timeZone })
        .replaceAll("/", "-")
    : ""

/** 相对时间：刚刚 / 5 分钟前 / 3 小时前 / 昨天 14:20 / 9月27日 / 2025年9月27日。依赖本地时钟，只在浏览器里用 */
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
/** 完整时间（悬停提示） */
export const fullTime = (d: string | Date) =>
  new Date(d).toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

const noSubscribe = () => () => {}
/** 水合完成后为 true；服务器上和水合时为 false */
export const useHydrated = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )
