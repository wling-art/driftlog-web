import { Link } from "@tanstack/react-router"
import { Folder } from "@/components/boring"
import { Article } from "@/components/article"
import { Comments } from "@/components/comments"
import { SiteShell } from "@/components/site"
import { Window } from "@/components/boring"
import type { Entry } from "@/lib/api"
import { entryPath, formatDate, readingMinutes, site } from "@/lib/site"

const typeLabel = { post: "文章", note: "手记", page: "页面" } as const

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
export function EntryPage({ entry: e }: { entry: Entry }) {
  const meta = [
    e.type === "note" ? [e.mood, e.weather].filter(Boolean).join(" · ") : e.category?.name,
    formatDate(e.publishedAt ?? e.createdAt),
    e.type !== "page" && `阅读 ${readingMinutes(e.html)} 分钟`,
    e.views > 0 && `${e.views} 次阅读`,
  ].filter(Boolean)

  return (
    <SiteShell
      scene="read"
      folders={
        <>
          {e.toc.slice(0, 12).map((t) => (
            <a key={t.id} href={`#${t.id}`} className="folder" data-icon="doc">
              <span>{t.text}</span>
            </a>
          ))}
          {e.type !== "page" && (e.prev || e.next) && (
            <Folder target="nearby" icon="folder">
              上下篇
            </Folder>
          )}
          <Folder target="comments" icon="folder">
            评论
          </Folder>
        </>
      }
    >
      <Window
        id="article"
        name={`${e.slug}.md`}
        title={e.title}
        rule={`// ${meta.join(" · ")}`}
        closable={false}
      >
        {e.summary && (
          <aside className="mb-(--space-5) max-w-(--measure) rounded-[4px] border border-border bg-surface p-(--space-4) text-(length:--text-sm)">
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
      </Window>

      {e.type !== "page" && (e.prev || e.next) && (
        <Window id="nearby" name="nearby/" closable={false}>
          <nav aria-label={`上一篇和下一篇${typeLabel[e.type]}`} className="nearby">
            {e.prev && (
              <Link to={entryPath(e.type, e.prev.slug)} rel="prev" className="nearby-card">
                <span className="pixel-1">← 上一篇</span>
                <span className="t">{e.prev.title}</span>
              </Link>
            )}
            {e.next && (
              <Link to={entryPath(e.type, e.next.slug)} rel="next" className="nearby-card is-next">
                <span className="pixel-1">下一篇 →</span>
                <span className="t">{e.next.title}</span>
              </Link>
            )}
          </nav>
        </Window>
      )}

      <Comments entryId={e.id} />
    </SiteShell>
  )
}
