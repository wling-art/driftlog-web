import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { z } from "zod"
import { Window } from "@/components/boring"
import { Archive, Empty, SiteShell } from "@/components/site"
import { indexQuery, topicsQuery } from "@/lib/api"
import { siteOf } from "@/lib/site"

export const Route = createFileRoute("/notes/")({
  validateSearch: z.object({ topic: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(indexQuery("note", deps)),
      context.queryClient.ensureQueryData(topicsQuery()),
    ]),
  head: ({ matches }) => ({ meta: [{ title: `手记 · ${siteOf(matches).title}` }] }),
  component: Notes,
})

function Notes() {
  const q = Route.useSearch()
  const { data } = useSuspenseQuery(indexQuery("note", q))
  const { data: topics } = useSuspenseQuery(topicsQuery())
  const current = topics.find((t) => t.slug === q.topic)

  return (
    <SiteShell
      folders={
        // 专栏就是文件夹（和文章页的分类一样）
        <>
          <Link to="/notes" search={{}} className="folder" activeOptions={{ includeSearch: true }}>
            <span>全部</span>
          </Link>
          {topics.map((t) => (
            <Link
              key={t.id}
              to="/notes"
              search={{ topic: t.slug }}
              className="folder"
              title={t.introduce || t.name}
              activeOptions={{ includeSearch: true }}
            >
              <span>{t.name}</span>
            </Link>
          ))}
        </>
      }
    >
      <Window
        id="notes"
        name={current ? `notes/${current.slug}/` : "notes/"}
        title={current?.name ?? "手记"}
        rule={`// ${current?.introduce || "不成文的碎碎念"} · 共 ${data.length} 篇`}
        closable={false}
      >
        {current?.description && <p className="topic-desc">{current.description}</p>}
        {data.length ? (
          <Archive items={data} type="note" />
        ) : (
          <Empty>这里还很无聊，今天也没什么想说的。</Empty>
        )}
      </Window>
    </SiteShell>
  )
}
