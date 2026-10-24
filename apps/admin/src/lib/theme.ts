import { useCallback, useSyncExternalStore } from "react"

// 亮 / 暗主题：默认跟随系统，切换后存进 localStorage（首帧由 index.html 的内联脚本设置）
type Theme = "light" | "dark"
const listeners = new Set<() => void>()
const current = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light")

export function useTheme() {
  const theme = useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), current)
  const toggle = useCallback(() => {
    const next: Theme = current() === "dark" ? "light" : "dark"
    document.documentElement.classList.toggle("dark", next === "dark")
    try {
      localStorage.setItem("admin-theme", next)
    } catch {}
    listeners.forEach((l) => l())
  }, [])
  return { theme, toggle }
}
