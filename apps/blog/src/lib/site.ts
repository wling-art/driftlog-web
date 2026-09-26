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
