import { useEffect, useLayoutEffect, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"

// 换页方向：导航前 markDirection，新页面挂载时 takeDirection 读出，用于入场动画
export type Direction = "forward" | "back"
let pending: { dir: Direction; at: number } | null = null

export function markDirection(dir: Direction) {
  pending = { dir, at: performance.now() }
}
/** 1 秒内标过的方向，否则 null */
export function takeDirection(): Direction | null {
  return pending && performance.now() - pending.at < 1000 ? pending.dir : null
}

type Target = { to: string; search?: unknown } | null

/** ← → 翻页，Esc 回上一级；忽略输入框、弹窗和带修饰键的按键 */
export function useArrowNav(prev: Target, next: Target, up: Target = null) {
  const navigate = useNavigate()
  // 监听器只挂一次，按键时读 ref 里的最新目标
  const targets = useRef({ prev, next, up })
  useLayoutEffect(() => {
    targets.current = { prev, next, up }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], [role=dialog]"))
        return
      const { prev, next, up } = targets.current
      const dir: Direction | null =
        e.key === "ArrowLeft" || e.key === "Escape" ? "back" : e.key === "ArrowRight" ? "forward" : null
      const to = e.key === "Escape" ? up : dir === "back" ? prev : dir === "forward" ? next : null
      if (!dir || !to) return
      e.preventDefault()
      markDirection(dir)
      void navigate(to as Parameters<typeof navigate>[0])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate])
}
