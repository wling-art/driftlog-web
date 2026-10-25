import { useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { indexQuery } from "@/lib/api"
import { entryPath } from "@/lib/site"
import { useUI } from "@/lib/store"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const fixed: Record<string, string> = {
  "/": "首页",
  "/posts": "文章",
  "/notes": "手记",
  "/thinking": "动态",
  "/projects": "项目",
  "/friends": "友链",
  "/says": "一言",
}

/** 「N 人在看」：悬浮显示他们在看哪些页面 */
export function OnlineCount() {
  const online = useUI((s) => s.online)
  const pages = useUI((s) => s.onlinePages)
  const [open, setOpen] = useState(false)
  const titles = useQueries({
    queries: (["post", "note"] as const).map((type) => ({ ...indexQuery(type), enabled: open })),
  })
  if (online <= 0) return null

  const label: Record<string, string> = { ...fixed }
  titles.forEach((q, i) => {
    for (const e of q.data ?? []) label[entryPath(i === 0 ? "post" : "note", e.slug)] = e.title
  })
  const rows = Object.entries(pages).sort((a, b) => b[1] - a[1])
  const unknown = online - rows.reduce((n, [, c]) => n + c, 0)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span className="clock" tabIndex={0}>
          {online} 人在看
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm flex-col items-start gap-1">
        {rows.map(([path, n]) => (
          <span key={path} className="flex w-full justify-between gap-4">
            <span className="truncate">{label[decodeURIComponent(path)] ?? path}</span>
            <span>{n}</span>
          </span>
        ))}
        {unknown > 0 && (
          <span className="flex w-full justify-between gap-4 opacity-70">
            <span>页面未知</span>
            <span>{unknown}</span>
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
