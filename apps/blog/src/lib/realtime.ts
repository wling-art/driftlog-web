import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { wsEvent } from "@driftlog/client"
import { site, entryPath } from "./site"
import { useUI } from "./store"

/** 订阅服务端 WebSocket：在线人数、新评论、新文章；断线后指数退避重连 */
export function useRealtime() {
  const qc = useQueryClient()
  const setOnline = useUI((s) => s.setOnline)

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const connect = () => {
      ws = new WebSocket(`${site.api.replace(/^http/, "ws")}/ws`)
      ws.onopen = () => (retry = 0)
      ws.onmessage = (m) => {
        const parsed = wsEvent.safeParse(JSON.parse(String(m.data)))
        if (!parsed.success) return
        const e = parsed.data
        if (e.type === "online") setOnline(e.count)
        else if (e.type === "comment.created") qc.invalidateQueries({ queryKey: ["comments", e.entryId] })
        else if (e.type === "entry.published") {
          qc.invalidateQueries({ queryKey: ["entries"] })
          toast(`刚发布：${e.title}`, {
            action: { label: "去看看", onClick: () => location.assign(entryPath(e.entryType, e.slug)) },
          })
        }
      }
      ws.onclose = () => {
        if (stopped) return
        timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++))
      }
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [qc, setOnline])
}
