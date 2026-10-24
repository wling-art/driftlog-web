import { useEffect, useRef } from "react"
import { useTheme } from "@/components/boring"

/** 正文 HTML；在浏览器里处理剧透，并按需渲染 Mermaid 和 Excalidraw */
export function Article({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 剧透：可聚焦，点击切换展开
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
    // 有图时才加载 Mermaid
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

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Excalidraw 块：pre.excalidraw，或内容是 Excalidraw JSON 的 Shiki 代码块；已画的 figure 换主题时重画
    const nodes = [
      ...el.querySelectorAll<HTMLElement>("pre.excalidraw, pre.shiki, figure.excalidraw-figure"),
    ].filter((n) => (n.dataset.src ?? n.textContent ?? "").trimStart().startsWith('{"type":"excalidraw'))
    if (!nodes.length) return
    let cancelled = false
    // 有图时才加载 Excalidraw，用 exportToSvg 画成静态 SVG
    void import("@excalidraw/excalidraw").then(async ({ exportToSvg }) => {
      for (const n of nodes) {
        n.dataset.src ??= n.textContent ?? ""
        try {
          const scene = JSON.parse(n.dataset.src) as { elements: never[]; files?: never }
          const svg = await exportToSvg({
            elements: scene.elements,
            files: scene.files ?? null,
            appState: { exportBackground: false, exportWithDarkMode: theme === "dark", exportPadding: 8 },
          })
          if (cancelled) return
          svg.removeAttribute("width")
          svg.removeAttribute("height")
          svg.setAttribute("role", "img")
          svg.setAttribute("aria-label", "示意图")
          const fig = document.createElement("figure")
          fig.className = "excalidraw-figure"
          fig.dataset.src = n.dataset.src
          fig.append(svg)
          n.replaceWith(fig)
        } catch {
          // JSON 无效：保留原文
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [html, theme])

  return <div ref={ref} className="prose" dangerouslySetInnerHTML={{ __html: html }} />
}
