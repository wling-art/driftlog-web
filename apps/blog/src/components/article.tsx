import { useEffect, useRef } from "react"
import { useTheme } from "@/components/boring"

/** 服务端渲染好的正文。只在浏览器里补两件事：点开剧透、按需加载 Mermaid */
export function Article({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 剧透：触屏没有悬停，点一下展开；键盘能聚焦到
    for (const s of el.querySelectorAll<HTMLElement>(".md-spoiler")) {
      s.tabIndex = 0
      s.setAttribute("role", "button")
      s.setAttribute("aria-label", "剧透，点开看")
    }
    const onClick = (e: MouseEvent) =>
      (e.target as HTMLElement).closest(".md-spoiler")?.classList.toggle("is-open")
    el.addEventListener("click", onClick)
    return () => el.removeEventListener("click", onClick)
  }, [html])

  useEffect(() => {
    const nodes = ref.current?.querySelectorAll<HTMLElement>("pre.mermaid")
    if (!nodes?.length) return
    let cancelled = false
    // Mermaid 很大，只有页面里真有图时才加载
    import("mermaid").then(({ default: mermaid }) => {
      if (cancelled) return
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === "dark" ? "dark" : "neutral",
        fontFamily: "inherit",
      })
      for (const n of nodes) {
        n.dataset.src ??= n.textContent ?? ""
        n.removeAttribute("data-processed")
        n.textContent = n.dataset.src
      }
      void mermaid.run({ nodes: [...nodes] })
    })
    return () => {
      cancelled = true
    }
  }, [html, theme])

  return <div ref={ref} className="prose" dangerouslySetInnerHTML={{ __html: html }} />
}
