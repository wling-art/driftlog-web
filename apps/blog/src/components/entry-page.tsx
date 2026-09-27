import { useEffect, useState } from "react"
import { Link, notFound, redirect } from "@tanstack/react-router"
import { toast } from "sonner"
import type { QueryClient } from "@tanstack/react-query"
import { unwrap } from "@driftlog/client"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Heart, MessageSquare } from "lucide-react"
import { Window } from "@/components/boring"
import { Article } from "@/components/article"
import { BackLink, SiteShell } from "@/components/site"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api, commentsQuery, entryQuery, isNotFound, useSite, type Entry } from "@/lib/api"
import { markDirection, useArrowNav } from "@/lib/keys"
import { useUI } from "@/lib/store"
import { entryPath, formatDate, readingMinutes, site, siteOf } from "@/lib/site"
export { siteOf }

/** 文章 / 手记 / 页面的 head：标题、描述、OG 图、JSON-LD */
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
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
  }
}

/** 阅读场景：一个最大化的文档窗口 + 评论 + 上一篇 / 下一篇。左边文件夹列是目录 */
const typeLabel = { post: "文章", note: "手记", page: "页面" } as const
/** 上一级：文章 / 手记回到列表，页面回首页 */
const upOf = {
  post: { to: "/posts", label: "文章" },
  note: { to: "/notes", label: "手记" },
  page: { to: "/", label: "首页" },
}
// 语言代码 → 中文名（ja → 日语）；不认识的原样显示
const langName = (l: string) => {
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "language" }).of(l) ?? l
  } catch {
    return l
  }
}

/**
 * 阅读场景：整页只有一个文章窗口，左边文件夹列是目录。
 * 次要的东西都退到外壳里：
 * - 上一篇 / 下一篇是标题栏右边的 ‹ ›（← → 键也能翻），正文末尾一行「下一篇：…」
 * - 评论最小化在任务栏（见 comments-dock.tsx），正文末尾一行「N 条评论 · 打开」
 */
export function EntryPage({ entry: e }: { entry: Entry }) {
  const type = e.type as keyof typeof typeLabel
  const meta = [
    e.type === "note" ? e.topic?.name : e.category?.name,
    e.type === "note" && [e.mood, e.weather].filter(Boolean).join(" · "),
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

  const info = useSite()
  const paged = e.type !== "page"
  const prev = paged && e.prev ? { to: entryPath(type, e.prev.slug), title: e.prev.title } : null
  const next = paged && e.next ? { to: entryPath(type, e.next.slug), title: e.next.title } : null
  const up = upOf[type]
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
        rule={e.type === "page" && e.subtitle ? `// ${e.subtitle}` : `// ${meta.join(" · ")}`}

        lead={<BackLink to={up.to} label={up.label} />}
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
          // 语言：一排按钮，正在看的那个反白（像分段控件），不用猜哪个是当前的
          <nav className="lang-switch" aria-label="换一种语言读">
            {[null, ...e.languages].map((l) => {
              const on = (e.lang ?? null) === l
              return (
                <Button key={l ?? "orig"} size="sm" asChild>
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

        {/* 正文末尾：先是两个按钮（喜欢 / 评论），再一行去哪：接着读下一篇，或者回列表 */}
        <footer id="article-end" className="article-end">
          <div className="article-end-actions">
            <LikeButton id={e.id} likes={e.likes} />
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

/** 喜欢：同一个人（IP）只算一次；点过就变成「已喜欢」 */
function LikeButton({ id, likes }: { id: number; likes: number }) {
  const [state, setState] = useState<{ n: number; liked: boolean }>({ n: likes, liked: false })
  const like = async () => {
    try {
      const r = await unwrap(api.entries({ id }).like.post())
      setState({ n: r.likes, liked: true })
    } catch {
      setState((s) => ({ ...s, liked: true }))
    }
  }
  // 点过不禁用（禁用会变淡，像坏了），只是再点不发请求
  return (
    <Button
      aria-pressed={state.liked}
      data-on={state.liked || undefined}
      onClick={() => !state.liked && void like()}
    >
      <Heart aria-hidden="true" />
      {state.liked ? "已喜欢" : "喜欢"}
      {state.n > 0 && ` ${state.n}`}
    </Button>
  )
}

/**
 * 详情页的 loader：找不到时查一下是不是改过名的旧 slug，是就 301 到新地址，否则 404
 */
export async function loadEntry(
  qc: QueryClient,
  type: "post" | "note" | "page",
  slug: string,
  lang?: string,
) {
  try {
    return await qc.ensureQueryData(entryQuery(type, slug, lang))
  } catch (e) {
    if (!isNotFound(e)) throw e
    const moved = await unwrap(api.entries.resolve.get({ query: { type, slug } })).catch(() => null)
    if (moved) throw redirect({ href: entryPath(type, moved.slug), statusCode: 301 })
    throw notFound()
  }
}

/**
 * 版权声明（参考 Shiro）：一张小卡片写清楚这篇是谁的、在哪、什么时候写的、能怎么用。
 * 链接能一键复制；协议是 CC BY-NC-SA 4.0
 */
function Copyright({ entry: e, author }: { entry: Entry; author: string }) {
  const url = `${site.url}${entryPath(e.type, e.slug)}`
  const published = e.publishedAt ?? e.createdAt
  // 发布当天改的不算「更新」
  const updated =
    new Date(e.updatedAt).getTime() - new Date(published).getTime() > 86_400_000 ? e.updatedAt : null
  return (
    <aside className="copyright" aria-label="版权声明">
      <div className="copyright-text">
        <p className="copyright-title">{e.title}</p>
        <p className="copyright-link">
          <a href={url}>{decodeURI(url)}</a>
          <button
            type="button"
            className="c-reply"
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
