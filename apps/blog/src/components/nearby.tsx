import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Window, bringFront } from "@/components/boring"
import { indexQuery, type Entry } from "@/lib/api"
import { back, forward, useArrowNav } from "@/lib/keys"
import { entryPath } from "@/lib/site"

const typeLabel = { post: "文章", note: "手记", page: "页面" } as const

/**
 * 上一篇 / 下一篇：两张卡片，上一篇贴左、下一篇贴右。
 * - 翻过去时内容往对应方向滑；← → 键也能翻
 * - 读到正文末尾（滚下来才看到的那种）时，窗口被「叫到前面」弹一下，副标题换成「读完了」，下一篇卡片被推荐
 */
export function Nearby({ entry: e }: { entry: Entry }) {
  const type = e.type as keyof typeof typeLabel
  const { data: all } = useQuery(indexQuery(type))
  const [finishedSlug, setFinishedSlug] = useState<string | null>(null)
  const finished = finishedSlug === e.slug
  const winRef = useRef<HTMLElement | null>(null)

  useArrowNav(e.prev && { to: entryPath(type, e.prev.slug) }, e.next && { to: entryPath(type, e.next.slug) })

  // 读到末尾：弹一下，只一次。末尾一打开就看得见（短文章）不算读完
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

  const index = all?.findIndex((x) => x.slug === e.slug) ?? -1
  const rule = finished ? (
    `// 读完了 ✓ ${e.next ? "下一篇？" : "这是最新的一篇"}`
  ) : (
    <>
      {"// "}
      {index >= 0 && `第 ${index + 1} 篇，共 ${all!.length} 篇`}
      <span className="only-fine"> · 按 ← → 翻篇</span>
    </>
  )

  return (
    <Window id="nearby" name="nearby/" rule={rule} closable={false}>
      <nav aria-label={`上一篇和下一篇${typeLabel[type]}`} className="nearby">
        {e.prev && (
          <Link to={entryPath(type, e.prev.slug)} rel="prev" viewTransition={back} className="nearby-card">
            <span className="pixel-1">← 上一篇</span>
            <span className="t">{e.prev.title}</span>
          </Link>
        )}
        {e.next && (
          <Link
            to={entryPath(type, e.next.slug)}
            rel="next"
            viewTransition={forward}
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
