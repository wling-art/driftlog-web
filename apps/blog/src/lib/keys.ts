import { useEffect, useLayoutEffect, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"

/** 翻页方向：给 View Transition 用，下一页从右边进来、上一页从左边进来 */
export const forward = { types: ["page-forward"] }
export const back = { types: ["page-back"] }

/** ← → 键翻页。输入框、弹窗里不管；带修饰键不管 */
// 地址是运行时拼出来的（/posts/xxx），所以这里用宽松的形状，交给 navigate 时再收窄
type Target = { to: string; search?: unknown } | null

export function useArrowNav(prev: Target, next: Target) {
  const navigate = useNavigate()
  // 目标放 ref 里，监听器只挂一次、每次按键读最新的。
  // （不能拿目标当依赖比较：search 常常是函数，JSON 序列化会把它丢掉，第 1 页和第 2 页就「一样」了）
  const targets = useRef({ prev, next })
  // 绘制前就换成新目标：新页面一出现，方向键立刻指向新的上一页 / 下一页
  useLayoutEffect(() => {
    targets.current = { prev, next }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], [role=dialog]"))
        return
      const { prev, next } = targets.current
      const to =
        e.key === "ArrowLeft"
          ? prev && { ...prev, viewTransition: back }
          : e.key === "ArrowRight"
            ? next && { ...next, viewTransition: forward }
            : null
      if (!to) return
      e.preventDefault()
      void navigate(to as Parameters<typeof navigate>[0])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate])
}
