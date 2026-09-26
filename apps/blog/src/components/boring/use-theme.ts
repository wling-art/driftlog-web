import { useCallback, useEffect, useSyncExternalStore } from "react"

/*
 * 主题：默认跟随系统；用户点过之后记住（localStorage），写到 <html data-theme>。
 * tokens.css 和 Tailwind 的 dark: 变体都认 data-theme，不认 .dark。
 */
type Theme = "light" | "dark"
const KEY = "boring-theme"
const media = () => window.matchMedia("(prefers-color-scheme: dark)")

function read(): Theme | null {
  try {
    const t = localStorage.getItem(KEY)
    return t === "light" || t === "dark" ? t : null
  } catch {
    return null
  }
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function subscribe(cb: () => void) {
  listeners.add(cb)
  const mq = media()
  mq.addEventListener("change", cb)
  return () => {
    listeners.delete(cb)
    mq.removeEventListener("change", cb)
  }
}

const resolved = (): Theme =>
  (document.documentElement.dataset.theme as Theme) || (media().matches ? "dark" : "light")

export function useTheme() {
  useEffect(() => {
    const t = read()
    if (t) {
      document.documentElement.dataset.theme = t
      emit()
    }
  }, [])
  const theme = useSyncExternalStore(subscribe, resolved, () => "light" as Theme)
  const toggle = useCallback(() => {
    const next: Theme = resolved() === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* 隐私模式等情况存不了，就只在这次生效 */
    }
    emit()
  }, [])
  return { theme, toggle }
}
