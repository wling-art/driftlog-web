import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { z } from "zod"
import { Window } from "@/components/boring"
import { Empty, EntryList, Pager, SiteShell } from "@/components/site"
import { categoriesQuery, entriesQuery } from "@/lib/api"
import { site } from "@/lib/site"

const search = z.object({
  page: z.number().int().min(1).optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
})

export const Route = createFileRoute("/posts/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(entriesQuery({ type: "post", ...deps })),
      context.queryClient.ensureQueryData(categoriesQuery()),
    ]),
  head: () => ({ meta: [{ title: `文章 · ${site.name}` }] }),
  component: Posts,
})

function Posts() {
  const q = Route.useSearch()
  const { data } = useSuspenseQuery(entriesQuery({ type: "post", ...q }))
  const { data: categories } = useSuspenseQuery(categoriesQuery())
  const current = categories.find((c) => c.slug === q.category)
  const title = current?.name ?? (q.tag ? `#${q.tag}` : "文章")

  return (
    <SiteShell
      folders={
        // 分类就是文件夹
        <>
          <Link to="/posts" search={{}} className="folder" activeOptions={{ includeSearch: true }}>
            <span>全部</span>
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/posts"
              search={{ category: c.slug }}
              className="folder"
              activeOptions={{ includeSearch: true }}
            >
              <span>{c.name}</span>
            </Link>
          ))}
        </>
      }
    >
      <Window
        id="posts"
        name="posts/"
        title={title}
        rule={`// ${current?.description || `共 ${data.total} 篇`}`}
        closable={false}
      >
        {data.items.length ? <EntryList items={data.items} /> : <Empty>这里还很无聊，一篇都没有。</Empty>}
        <Pager page={data.page} size={data.size} total={data.total} to="/posts" />
      </Window>
    </SiteShell>
  )
}
