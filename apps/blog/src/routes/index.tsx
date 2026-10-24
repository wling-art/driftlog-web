import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Window } from "@/components/boring"
import { Hero } from "@/components/hero"
import { Button } from "@/components/ui/button"
import { Empty, EntryList, SiteShell } from "@/components/site"
import { entriesQuery, saysQuery, useSite } from "@/lib/api"
import { site, siteOf } from "@/lib/site"

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(entriesQuery("post")),
      context.queryClient.ensureQueryData(entriesQuery("note")),
      context.queryClient.ensureQueryData(saysQuery()),
    ]),
  head: ({ matches }) => {
    const s = siteOf(matches)
    return {
      meta: [
        { title: s.description ? `${s.title} · ${s.description}` : s.title },
        {
          "script:ld+json": {
            "@context": "https://schema.org",
            "@type": "Blog",
            name: s.title,
            description: s.description,
            url: site.url,
          },
        },
      ],
    }
  },
  component: Home,
})

function Home() {
  const info = useSite()
  const { data: posts } = useSuspenseQuery(entriesQuery("post"))
  const { data: notes } = useSuspenseQuery(entriesQuery("note"))
  const { data: says } = useSuspenseQuery(saysQuery())
  // 一言：按 UTC 日期每天换一条
  const [day] = useState(() => Math.floor(Date.now() / 86_400_000))
  const say = says.length ? says[day % says.length] : null

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
      <Hero info={info} say={say} />

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
