import { useCallback, useSyncExternalStore } from "react"

// 亮 / 暗：跟随系统，点过之后记住。index.html 里的内联脚本在首帧前就加好 .dark
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
