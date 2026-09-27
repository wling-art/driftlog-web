import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Window, bringFront } from "@/components/boring"
import { indexQuery, type Entry } from "@/lib/api"
import { entryPath, formatDate } from "@/lib/site"

const typeLabel = { post: "文章", note: "手记", page: "页面" } as const

/**
 * 翻页窗口「archive/」：
 * - 一条「磁带」：每篇是一根刻度，按时间从早到晚；这篇的刻度像任务栏标签一样升起来。
 *   指上去 / 键盘聚焦时，上面那行读数显示它的标题和日期，点一下直接过去
 * - 下面是上一篇 / 下一篇两张卡片（磁带只是快捷方式，卡片才是正门）
 * - ← → 键翻页（输入框里不管）
 * - 读到正文末尾时，这个窗口被「叫到前面」弹一下，副标题换成「读完了」：结尾值得一点仪式感
 */
export function Nearby({ entry: e }: { entry: Entry }) {
  const type = e.type as keyof typeof typeLabel
  const { data: all } = useQuery(indexQuery(type))
  const navigate = useNavigate()
  const [hover, setHover] = useState<{ title: string; publishedAt: string | Date | null } | null>(null)
  // 按 slug 记「读完了」：换到别的文章自然就不算
  const [finishedSlug, setFinishedSlug] = useState<string | null>(null)
  const finished = finishedSlug === e.slug
  const winRef = useRef<HTMLElement | null>(null)

  const index = all?.findIndex((x) => x.slug === e.slug) ?? -1
  const total = all?.length ?? 0

  // ← → 翻页
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey || ev.shiftKey) return
      const t = ev.target as HTMLElement
      if (t.closest("input, textarea, select, [contenteditable], [role=dialog]")) return
      const to = ev.key === "ArrowLeft" ? e.prev : ev.key === "ArrowRight" ? e.next : null
      if (!to) return
      ev.preventDefault()
      navigate({ to: entryPath(type, to.slug) })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [e.prev, e.next, navigate, type])

  // 读到末尾：弹一下，只一次。末尾一打开就看得见（短文章）不算读完——得是滚下来才看到的
  useEffect(() => {
    const end = document.getElementById("article-end")
    if (!end) return
    let first = true
    const io = new IntersectionObserver(([x]) => {
      const initial = first
      first = false
      if (!x?.isIntersecting) return
      io.disconnect()
      if (initial) return
      setFinishedSlug(e.slug)
      winRef.current ??= document.getElementById("nearby")
      bringFront(winRef.current)
    })
    io.observe(end)
    return () => io.disconnect()
  }, [e.slug])

  const rule = finished ? (
    `// 读完了 ✓ ${e.next ? "下一篇？" : "这是最新的一篇"}`
  ) : (
    <>
      {"// "}
      {index >= 0 && `第 ${index + 1} / ${total} 篇`}
      {/* 键盘提示只给有鼠标键盘的设备 */}
      <span className="only-fine"> · ← → 翻页</span>
    </>
  )

  return (
    <Window id="nearby" name="archive/" rule={rule} closable={false}>
      {total > 1 && (
        <div className="tape-wrap">
          <p className="tape-readout" aria-hidden="true">
            {hover ? (
              <>
                <span className="pixel-1">{formatDate(hover.publishedAt)}</span> {hover.title}
              </>
            ) : (
              <span className="muted">
                <span className="only-fine">指一下刻度看看是哪篇</span>
                <span className="only-touch">点刻度直接跳到那一篇</span>
              </span>
            )}
          </p>
          <ol className="tape" aria-label={`全部${typeLabel[type]}，按时间排列`}>
            {all!.map((x, i) => (
              <li key={x.slug}>
                <Link
                  to={entryPath(type, x.slug)}
                  className="tick"
                  aria-current={i === index ? "page" : undefined}
                  aria-label={`${x.title}（${formatDate(x.publishedAt)}）`}
                  onPointerEnter={() => setHover(x)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(x)}
                  onBlur={() => setHover(null)}
                />
              </li>
            ))}
          </ol>
        </div>
      )}
      <nav aria-label={`上一篇和下一篇${typeLabel[type]}`} className="nearby">
        {e.prev && (
          <Link to={entryPath(type, e.prev.slug)} rel="prev" className="nearby-card">
            <span className="pixel-1">← 上一篇</span>
            <span className="t">{e.prev.title}</span>
          </Link>
        )}
        {e.next && (
          <Link
            to={entryPath(type, e.next.slug)}
            rel="next"
            className={`nearby-card is-next${finished ? " is-suggested" : ""}`}
          >
            <span className="pixel-1">下一篇 →</span>
            <span className="t">{e.next.title}</span>
          </Link>
        )}
      </nav>
    </Window>
  )
}
