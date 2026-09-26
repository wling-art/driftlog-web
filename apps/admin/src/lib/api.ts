import { createClient, unwrap } from "@driftlog/client"
import { createAuthClient } from "better-auth/react"
import { passkeyClient } from "@better-auth/passkey/client"

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3900").replace(/\/$/, "")
export const BLOG_URL = (import.meta.env.VITE_BLOG_URL ?? "http://localhost:5173").replace(/\/$/, "")

export const api = createClient(API_URL)
export const auth = createAuthClient({ baseURL: API_URL, plugins: [passkeyClient()] })
export { unwrap }

export const blogPath = (type: string, slug: string) =>
  `${BLOG_URL}${type === "page" ? "" : `/${type}s`}/${slug}`

export const formatBytes = (n: number) => {
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`
}

export const formatTime = (d: string | Date | null | undefined) =>
  d
    ? new Date(d).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"
