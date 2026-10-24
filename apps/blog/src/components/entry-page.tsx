import { useEffect } from "react"
import { Link, notFound, redirect } from "@tanstack/react-router"
import { toast } from "sonner"
import { useQuery, type QueryClient } from "@tanstack/react-query"
import { unwrap } from "@driftlog/client"
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react"
import { Window } from "@/components/boring"
import { Article } from "@/components/article"
import { LikeButton } from "@/components/like-button"
import { BackLink, SiteShell } from "@/components/site"
import { TocButton, TocPanel } from "@/components/toc"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api, commentsQuery, entryQuery, isNotFound, useSite, type Entry } from "@/lib/api"
import { markDirection, useArrowNav } from "@/lib/keys"
import { useUI, type Crumb } from "@/lib/store"
import { entryPath, formatDate, readingMinutes, site, typeLabel, type EntryType } from "@/lib/site"

/** 详情页的 head：标题、描述、OG 图、JSON-LD */
export function entryHead(e: Entry | undefined, info: { title: string; owner: { name: string } }) {
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
    author: { "@type": "Person", name: info.owner.name },
    image,
    url,
    keywords: e.tags.join(","),
  }
  return {
    meta: [
      { title: `${e.title} · ${info.title}` },
      { name: "description", content: description },
      { property: "og:type", content: e.type === "page" ? "website" : "article" },
      { property: "og:title", content: e.title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { "script:ld+json": ld },
    ],
    links: [{ rel: "canonical", href: url }],
  }
}

/** 上一级：文章、手记回列表，页面回首页 */
const upOf = {
  post: { to: "/posts", label: "文章" },
  note: { to: "/notes", label: "手记" },
  page: { to: "/", label: "首页" },
}
// 语言代码转中文名（ja → 日语），不认识的原样返回
const langName = (l: string) => {
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "language" }).of(l) ?? l
  } catch {
    return l
  }
}

/** 文章 / 手记 / 页面详情：一个文章窗口，左边是目录 */
export function EntryPage({ entry: e }: { entry: Entry }) {
  const type = e.type
  const meta = [
    e.type === "note" ? e.topic?.name : e.category?.name,
    e.type === "note" && [e.mood, e.weather].filter(Boolean).join(" · "),
    formatDate(e.publishedAt ?? e.createdAt),
    e.type !== "page" && `阅读 ${readingMinutes(e.html)} 分钟`,
    e.views > 0 && `${e.views} 次阅读`,
  ].filter(Boolean)

  // 在任务栏登记本页评论
  const setComments = useUI((s) => s.setComments)
  const setCommentsOpen = useUI((s) => s.setCommentsOpen)
  useEffect(() => {
    setComments({ entryId: e.id, title: e.title })
    return () => setComments(null)
  }, [e.id, e.title, setComments])
  const { data: comments } = useQuery(commentsQuery(e.id))

  const info = useSite()
  const paged = e.type !== "page"
  const prev = paged && e.prev ? { to: entryPath(type, e.prev.slug), title: e.prev.title } : null
  const next = paged && e.next ? { to: entryPath(type, e.next.slug), title: e.next.title } : null
  const up = upOf[type]
  useArrowNav(prev, next)

  return (
    <SiteShell
      scene="read"
      crumbs={crumbsOf(e)}
      toc={e.toc.length > 1 ? <TocPanel items={e.toc} /> : undefined}
    >
      <Window
        id="article"
        name={`${e.slug}.md`}
        title={e.title}
        rule={e.type === "page" && e.subtitle ? `// ${e.subtitle}` : `// ${meta.join(" · ")}`}
        lead={<BackLink to={up.to} label={up.label} />}
        controls={
          (paged || e.toc.length > 1) && (
            <>
              {e.toc.length > 1 && <TocButton items={e.toc} />}
              {paged && (
                <>
                  <BarNav dir="prev" target={prev} label={typeLabel[type]} />
                  <BarNav dir="next" target={next} label={typeLabel[type]} />
                </>
              )}
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
          <nav className="lang-switch" aria-label="换一种语言读">
            {[null, ...e.languages].map((l) => {
              const on = (e.lang ?? null) === l
              return (
                <Button key={l ?? "orig"} asChild>
                  <Link
                    to="."
                    search={l ? { lang: l } : {}}
                    replace
                    data-on={on || undefined}
                    aria-current={on ? "true" : undefined}
                    lang={l ?? undefined}
                  >
                    {l ? langName(l) : "原文"}
                  </Link>
                </Button>
              )
            })}
          </nav>
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

        {e.copyright && e.type !== "page" && <Copyright entry={e} author={info.owner.name} />}

        {/* 正文末尾：喜欢、评论，以及下一篇或回列表 */}
        <footer id="article-end" className="article-end">
          <div className="article-end-actions">
            <LikeButton likes={e.likes} like={() => unwrap(api.entries({ id: e.id }).like.post())} />
            <Button onClick={() => setCommentsOpen(true)}>
              <MessageSquare aria-hidden="true" />
              {comments?.length ? `评论 ${comments.length}` : "写评论"}
            </Button>
          </div>
          <div className="article-end-nav">
            <Link to={up.to} onClick={() => markDirection("back")} className="article-end-link">
              ← {type === "page" ? "回首页" : `全部${up.label}`}
            </Link>
            {next ? (
              <Link to={next.to} onClick={() => markDirection("forward")} className="article-end-link">
                下一篇：{next.title} →
              </Link>
            ) : (
              paged && <span className="muted">这是最新的一篇</span>
            )}
          </div>
        </footer>
      </Window>
    </SiteShell>
  )
}

/** 标题栏上的 ‹ ›；没有目标时置灰占位 */
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

/** 详情页 loader：404 时查旧 slug，找到就 301 到新地址，否则 notFound */
export async function loadEntry(qc: QueryClient, type: EntryType, slug: string, lang?: string) {
  try {
    return await qc.ensureQueryData(entryQuery(type, slug, lang))
  } catch (e) {
    if (!isNotFound(e)) throw e
    const moved = await unwrap(api.entries.resolve.get({ query: { type, slug } })).catch(() => null)
    if (moved) throw redirect({ href: entryPath(type, moved.slug), statusCode: 301 })
    throw notFound()
  }
}

/** 版权声明卡片：作者、链接、发布 / 更新日期、CC BY-NC-SA 4.0 */
function Copyright({ entry: e, author }: { entry: Entry; author: string }) {
  const url = `${site.url}${entryPath(e.type, e.slug)}`
  const published = e.publishedAt ?? e.createdAt
  // 发布 24 小时后的修改才显示「更新于」
  const updated =
    new Date(e.updatedAt).getTime() - new Date(published).getTime() > 86_400_000 ? e.updatedAt : null
  return (
    <aside className="copyright" aria-label="版权声明">
      <div className="copyright-text">
        <p className="copyright-title">{e.title}</p>
        <p className="copyright-link">
          <a href={url}>{url}</a>
          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(url).then(
                () => toast("链接复制好了"),
                () => toast("没复制上，手动选一下吧"),
              )
            }
          >
            复制链接
          </button>
        </p>
        <dl className="copyright-meta">
          <div>
            <dt>作者</dt>
            <dd>{author}</dd>
          </div>
          <div>
            <dt>发布于</dt>
            <dd>{formatDate(published)}</dd>
          </div>
          {updated && (
            <div>
              <dt>更新于</dt>
              <dd>{formatDate(updated)}</dd>
            </div>
          )}
        </dl>
        <p className="copyright-license">
          按{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans"
            rel="license noopener"
            target="_blank"
          >
            CC BY-NC-SA 4.0
          </a>{" "}
          授权：转载请署名并附上原文链接；不能用于商业用途（商用请先联系我）；改编后要用同样的协议分享。
        </p>
      </div>
    </aside>
  )
}

/** 任务栏路径：栏目 / 分类或专栏 / 标题；页面只有标题 */
function crumbsOf(e: Entry): Crumb[] {
  if (e.type === "page") return [{ label: e.title }]
  const up = upOf[e.type]
  const group: Crumb | null =
    e.type === "note"
      ? e.topic && { label: e.topic.name, to: "/notes", search: { topic: e.topic.slug } }
      : e.category && { label: e.category.name, to: "/posts", search: { category: e.category.slug } }
  return [{ label: up.label, to: up.to }, ...(group ? [group] : []), { label: e.title }]
}
