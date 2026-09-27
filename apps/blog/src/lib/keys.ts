import { useEffect, useLayoutEffect, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"

/*
 * 换页方向：给窗口列的入场动画用（下一页从右边进来、上一页从左边）。
 * 不用浏览器的 View Transitions：自己在新窗口挂载时播一段 CSS 动画，桌面和任务栏完全不参与。
 * 点「下一篇」之类的链接前先 markDirection，新页面的窗口列挂载时 takeDirection 读出来。
 */
export type Direction = "forward" | "back"
let pending: { dir: Direction; at: number } | null = null

export function markDirection(dir: Direction) {
  pending = { dir, at: performance.now() }
}
/** 刚标过的方向（1 秒内有效，过期就当普通换页：从下面升上来）。不清空：开发模式下初始化会跑两遍 */
export function takeDirection(): Direction | null {
  return pending && performance.now() - pending.at < 1000 ? pending.dir : null
}

// 地址是运行时拼出来的（/posts/xxx），所以这里用宽松的形状，交给 navigate 时再收窄
type Target = { to: string; search?: unknown } | null

/** ← → 键翻页，Esc 回到上一级（列表）。输入框、弹窗里不管；带修饰键不管 */
export function useArrowNav(prev: Target, next: Target, up: Target = null) {
  const navigate = useNavigate()
  // 目标放 ref 里，监听器只挂一次、每次按键读最新的。
  // （不能拿目标当依赖比较：search 常常是函数，JSON 序列化会把它丢掉，第 1 页和第 2 页就「一样」了）
  const targets = useRef({ prev, next, up })
  // 绘制前就换成新目标：新页面一出现，方向键立刻指向新的上一页 / 下一页
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
