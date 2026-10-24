import { useEffect, useState } from "react"
import "katex/dist/katex.min.css"

/** Markdown 实时预览，用博客同一条渲染管线（@driftlog/markdown）。内容来自站长本人 */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  const [html, setHtml] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    const t = setTimeout(async () => {
      try {
        // 按需加载渲染管线
        const { renderMarkdown } = await import("@driftlog/markdown")
        const r = await renderMarkdown(markdown)
        if (!stale) {
          setHtml(r.html)
          setError(null)
        }
      } catch (e) {
        if (!stale) setError((e as Error).message)
      }
    }, 200)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [markdown])

  return (
    <>
      {error && <p className="mb-3 text-sm text-destructive">预览出错：{error}</p>}
      {html ? (
        <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-sm text-muted-foreground">左边写点什么，这里就会出现预览。</p>
      )}
    </>
  )
}
