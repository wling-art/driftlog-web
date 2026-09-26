import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { z } from "zod"
import { Window } from "@/components/boring"
import { Empty, EntryList, Pager, SiteShell } from "@/components/site"
import { entriesQuery } from "@/lib/api"
import { site } from "@/lib/site"

export const Route = createFileRoute("/notes/")({
  validateSearch: z.object({ page: z.number().int().min(1).optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(entriesQuery({ type: "note", ...deps })),
  head: () => ({ meta: [{ title: `手记 · ${site.name}` }] }),
  component: Notes,
})

function Notes() {
  const q = Route.useSearch()
  const { data } = useSuspenseQuery(entriesQuery({ type: "note", ...q }))
  return (
    <SiteShell>
      <Window id="notes" name="notes/" title="手记" rule="// 不成文的碎碎念，想到哪写到哪" closable={false}>
        {data.items.length ? (
          <EntryList items={data.items} />
        ) : (
          <Empty>这里还很无聊，今天也没什么想说的。</Empty>
        )}
        <Pager page={data.page} size={data.size} total={data.total} to="/notes" />
      </Window>
    </SiteShell>
  )
}
