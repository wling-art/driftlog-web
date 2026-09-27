import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Folder, Window } from "@/components/boring"
import { Button } from "@/components/ui/button"
import { Empty, EntryList, SiteShell } from "@/components/site"
import { entriesQuery } from "@/lib/api"
import { site } from "@/lib/site"

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(entriesQuery({ type: "post" })),
      context.queryClient.ensureQueryData(entriesQuery({ type: "note" })),
    ]),
  head: () => ({
    meta: [{ title: `${site.name} · ${site.description}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: site.name,
          description: site.description,
          url: site.url,
        }),
      },
    ],
  }),
  component: Home,
})

function Home() {
  const { data: posts } = useSuspenseQuery(entriesQuery({ type: "post" }))
  const { data: notes } = useSuspenseQuery(entriesQuery({ type: "note" }))
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
          <Folder target="readme" icon="doc">
            简介
          </Folder>
          <Folder target="latest-posts">文章</Folder>
          <Folder target="latest-notes">手记</Folder>
        </>
      }
    >
      <Window id="readme" name="readme.txt" title={site.name} rule={`// ${site.description}`}>
        <p className="max-w-(--measure)">
          {site.author} 写东西的地方。长一点的放在文章，短一点的放在手记。按{" "}
          <kbd className="font-mono">⌘K</kbd> 搜索，底下的任务栏能去别的地方。
        </p>
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
