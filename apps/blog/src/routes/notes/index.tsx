import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Window } from "@/components/boring"
import { Archive, Empty, SiteShell } from "@/components/site"
import { indexQuery } from "@/lib/api"
import { site } from "@/lib/site"

export const Route = createFileRoute("/notes/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(indexQuery("note")),
  head: () => ({ meta: [{ title: `手记 · ${site.name}` }] }),
  component: Notes,
})

function Notes() {
  const { data } = useSuspenseQuery(indexQuery("note"))
  return (
    <SiteShell>
      <Window
        id="notes"
        name="notes/"
        title="手记"
        rule={`// 不成文的碎碎念 · 共 ${data.length} 篇`}
        closable={false}
      >
        {data.length ? (
          <Archive items={data} type="note" />
        ) : (
          <Empty>这里还很无聊，今天也没什么想说的。</Empty>
        )}
      </Window>
    </SiteShell>
  )
}
