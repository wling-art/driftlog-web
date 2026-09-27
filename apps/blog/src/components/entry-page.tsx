import { useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Window } from "@/components/boring"
import { Article } from "@/components/article"
import { SiteShell } from "@/components/site"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { commentsQuery, type Entry } from "@/lib/api"
import { markDirection, useArrowNav } from "@/lib/keys"
import { useUI } from "@/lib/store"
import { entryPath, formatDate, readingMinutes, site } from "@/lib/site"

/** 文章 / 手记 / 页面的 head：标题、描述、OG 图、JSON-LD */
export function entryHead(e: Entry | undefined) {
  if (!e) return {}
  const url = `${site.url}${entryPath(e.type, e.slug)}`
  const description = e.summary ?? e.excerpt
  const image = `${site.url}/og/${e.type}/${e.slug}`
  const ld = {
    "@context": "https://schema.org",
    "@type": e.type === "page" ? "WebPage" : "BlogPosting",
    headline: e.title,
    description,
    datePublished: e.publishedAt,
    dateModified: e.updatedAt,
    author: { "@type": "Person", name: site.author },
    image,
    url,
    keywords: e.tags.join(","),
  }
  return {
    meta: [
      { title: `${e.title} · ${site.name}` },
      { name: "description", content: description },
      { property: "og:type", content: e.type === "page" ? "website" : "article" },
      { property: "og:title", content: e.title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
  }
}

/** 阅读场景：一个最大化的文档窗口 + 评论 + 上一篇 / 下一篇。左边文件夹列是目录 */
const typeLabel = { post: "文章", note: "手记", page: "页面" } as const

/**
 * 阅读场景：整页只有一个文章窗口，左边文件夹列是目录。
 * 次要的东西都退到外壳里：
 * - 上一篇 / 下一篇是标题栏右边的 ‹ ›（← → 键也能翻），正文末尾一行「下一篇：…」
 * - 评论最小化在任务栏（见 comments-dock.tsx），正文末尾一行「N 条评论 · 打开」
 */
export function EntryPage({ entry: e }: { entry: Entry }) {
  const type = e.type as keyof typeof typeLabel
  const meta = [
    e.type === "note" ? [e.mood, e.weather].filter(Boolean).join(" · ") : e.category?.name,
    formatDate(e.publishedAt ?? e.createdAt),
    e.type !== "page" && `阅读 ${readingMinutes(e.html)} 分钟`,
    e.views > 0 && `${e.views} 次阅读`,
  ].filter(Boolean)

  // 告诉任务栏：这页有评论可看
  const setComments = useUI((s) => s.setComments)
  const setCommentsOpen = useUI((s) => s.setCommentsOpen)
  useEffect(() => {
    setComments({ entryId: e.id, title: e.title })
    return () => setComments(null)
  }, [e.id, e.title, setComments])
  const { data: comments } = useQuery(commentsQuery(e.id))

  const paged = e.type !== "page"
  const prev = paged && e.prev ? { to: entryPath(type, e.prev.slug), title: e.prev.title } : null
  const next = paged && e.next ? { to: entryPath(type, e.next.slug), title: e.next.title } : null
  useArrowNav(prev, next)

  return (
    <SiteShell
      scene="read"
      folders={e.toc.slice(0, 12).map((t) => (
        <a key={t.id} href={`#${t.id}`} className="folder" data-icon="doc" title={t.text}>
          <span>{t.text}</span>
        </a>
      ))}
    >
      <Window
        id="article"
        name={`${e.slug}.md`}
        title={e.title}
        rule={`// ${meta.join(" · ")}`}
        closable={false}
        controls={
          paged && (
            <>
              <BarNav dir="prev" target={prev} label={typeLabel[type]} />
              <BarNav dir="next" target={next} label={typeLabel[type]} />
            </>
          )
        }
      >
        {e.summary && (
          <aside className="mb-(--space-5) rounded-[4px] border border-border bg-surface p-(--space-4) text-(length:--text-sm)">
            <span className="pixel-1 muted mb-1 block">AI 摘要</span>
            {e.summary}
          </aside>
        )}
        {e.languages.length > 0 && (
          <p className="mb-(--space-4) flex gap-(--space-3) text-(length:--text-sm)">
            <span className="muted">其他语言：</span>
            {e.lang && (
              <Link to="." search={{}} className="text-primary underline">
                原文
              </Link>
            )}
            {e.languages.map((l) => (
              <Link key={l} to="." search={{ lang: l }} className="text-primary underline">
                {l}
              </Link>
            ))}
          </p>
        )}
        <Article html={e.html} />
        {e.tags.length > 0 && (
          <p className="mt-(--space-6) flex flex-wrap gap-(--space-2)">
            {e.tags.map((t) => (
              <Link
                key={t}
                to="/posts"
                search={{ tag: t }}
                className="pixel-1 rounded-[4px] border border-input bg-surface px-2 py-1 hover:bg-foreground hover:text-background"
              >
                #{t}
              </Link>
            ))}
          </p>
        )}

        {/* 正文末尾一行：接着读，或者看看别人说了什么 */}
        <footer id="article-end" className="article-end">
          {next ? (
            <Link to={next.to} onClick={() => markDirection("forward")} className="article-end-next">
              下一篇：{next.title} →
            </Link>
          ) : (
            paged && <span className="muted">这是最新的一篇</span>
          )}
          <button type="button" className="article-end-comments" onClick={() => setCommentsOpen(true)}>
            {comments?.length ? `${comments.length} 条评论 · 打开` : "写评论"}
          </button>
        </footer>
      </Window>
    </SiteShell>
  )
}

/** 标题栏上的 ‹ ›：没有上一篇 / 下一篇时置灰但位置不变 */
function BarNav({
  dir,
  target,
  label,
}: {
  dir: "prev" | "next"
  target: { to: string; title: string } | null
  label: string
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight
  const name = `${dir === "prev" ? "上一篇" : "下一篇"}${label}`
  if (!target)
    return (
      <span className="win-btn" aria-disabled="true" title={`没有${name}了`}>
        <Icon aria-hidden="true" />
      </span>
    )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={target.to}
          rel={dir}
          onClick={() => markDirection(dir === "prev" ? "back" : "forward")}
          className="win-btn"
          aria-label={`${name}：${target.title}`}
        >
          <Icon aria-hidden="true" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        {dir === "prev" ? "← " : ""}
        {target.title}
        {dir === "next" ? " →" : ""}
      </TooltipContent>
    </Tooltip>
  )
}
