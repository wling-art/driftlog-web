import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Window } from "@/components/boring"
import { Button } from "@/components/ui/button"
import { Empty, EntryList, SiteShell } from "@/components/site"
import { entriesQuery, saysQuery, siteQuery, useSite } from "@/lib/api"
import { site, siteOf } from "@/lib/site"

// 社交账号 → 链接。只列站长填了的
const socialLinks: Record<string, { label: string; href: (v: string) => string }> = {
  github: { label: "GitHub", href: (v) => `https://github.com/${v}` },
  twitter: { label: "X", href: (v) => `https://x.com/${v}` },
  telegram: { label: "Telegram", href: (v) => `https://t.me/${v}` },
  bilibili: { label: "哔哩哔哩", href: (v) => `https://space.bilibili.com/${v}` },
  email: { label: "邮件", href: (v) => `mailto:${v}` },
}

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(entriesQuery({ type: "post" })),
      context.queryClient.ensureQueryData(entriesQuery({ type: "note" })),
      context.queryClient.ensureQueryData(saysQuery()),
      context.queryClient.ensureQueryData(siteQuery()),
    ]),
  head: ({ matches }) => {
    const s = siteOf(matches)
    return {
      meta: [{ title: s.description ? `${s.title} · ${s.description}` : s.title }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: s.title,
            description: s.description,
            url: site.url,
          }),
        },
      ],
    }
  },
  component: Home,
})

function Home() {
  const info = useSite()
  const { data: posts } = useSuspenseQuery(entriesQuery({ type: "post" }))
  const { data: notes } = useSuspenseQuery(entriesQuery({ type: "note" }))
  const { data: says } = useSuspenseQuery(saysQuery())
  // 一言：按日期挑一条，一天换一句（服务器和浏览器挑的一样，不会水合不一致）
  const [day] = useState(() => Math.floor(Date.now() / 86_400_000))
  const say = says.length ? says[day % says.length] : null
  const socials = Object.entries(info.owner.socials).filter(([k, v]) => v && socialLinks[k])

  return (
    <SiteShell
      aside={
        <Window id="latest-notes" name="notes/" title="最近的手记" rule="// 不成文的碎碎念">
          {notes.items.length ? (
            <EntryList items={notes.items.slice(0, 5)} />
          ) : (
            <Empty>今天也没什么想说的。</Empty>
          )}
          {notes.total > 5 && (
            <Button asChild className="mt-(--space-4)">
              <Link to="/notes">看全部手记</Link>
            </Button>
          )}
        </Window>
      }
      folders={
        // 首页的图标是快捷方式（像 Windows 桌面上的「文档」）：点了就进那个栏目
        <>
          <Link to="/posts" className="folder">
            <span>文章</span>
          </Link>
          <Link to="/notes" className="folder">
            <span>手记</span>
          </Link>
          <Link to="/thinking" className="folder">
            <span>动态</span>
          </Link>
          <Link to="/projects" className="folder">
            <span>项目</span>
          </Link>
          <Link to="/friends" className="folder">
            <span>友链</span>
          </Link>
          <Link to="/$slug" params={{ slug: "about" }} className="folder" data-icon="doc">
            <span>关于</span>
          </Link>
          <Link to="/$slug" params={{ slug: "message" }} className="folder" data-icon="doc">
            <span>留言板</span>
          </Link>
          <a href="/feed.xml" className="folder" data-icon="doc" title="RSS 订阅地址">
            <span>订阅</span>
          </a>
        </>
      }
    >
      <Window
        id="readme"
        name="readme.txt"
        title={info.title}
        rule={info.description ? `// ${info.description}` : undefined}
      >
        {info.owner.introduce && <p className="max-w-(--measure)">{info.owner.introduce}</p>}
        {socials.length > 0 && (
          <p className="home-socials">
            {socials.map(([k, v]) => (
              <a
                key={k}
                href={socialLinks[k]!.href(v)}
                target={k === "email" ? undefined : "_blank"}
                rel="noopener me"
              >
                {socialLinks[k]!.label}
              </a>
            ))}
          </p>
        )}
        {say && (
          <figure className="home-say">
            <blockquote>{say.text}</blockquote>
            {(say.author || say.source) && (
              <figcaption>
                —— {say.author}
                {say.source && (
                  <>
                    {" "}
                    <a href={say.source} target="_blank" rel="noopener">
                      出处
                    </a>
                  </>
                )}
              </figcaption>
            )}
          </figure>
        )}
      </Window>

      <Window id="latest-posts" name="posts/" title="最近的文章" rule={`// 共 ${posts.total} 篇`}>
        {posts.items.length ? (
          <EntryList items={posts.items.slice(0, 6)} />
        ) : (
          <Empty>这里还很无聊，一篇都没有。</Empty>
        )}
        {posts.total > 6 && (
          <Button asChild className="mt-(--space-4)">
            <Link to="/posts">看全部文章</Link>
          </Button>
        )}
      </Window>
    </SiteShell>
  )
}
