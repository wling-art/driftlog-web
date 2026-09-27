import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { unwrap } from "@driftlog/client"
import { Window } from "@/components/boring"
import { BackLink, Empty, SiteShell } from "@/components/site"
import { api, thoughtsQuery } from "@/lib/api"
import { fullTime, siteOf, timeAgo } from "@/lib/site"

// 动态：比手记更短的碎片。路径和 Shiro 一样（/thinking），旧链接直接能打开
export const Route = createFileRoute("/thinking")({
  loader: ({ context }) => context.queryClient.ensureQueryData(thoughtsQuery()),
  head: ({ matches }) => ({ meta: [{ title: `动态 · ${siteOf(matches).title}` }] }),
  component: Thinking,
})

function Thinking() {
  const { data } = useSuspenseQuery(thoughtsQuery())
  return (
    <SiteShell scene="read">
      <Window
        id="thinking"
        name="thinking.log"
        title="动态"
        rule="// 比手记还短的碎片，想到就记一句"
        lead={<BackLink to="/" label="首页" />}
        closable={false}
      >
        {data.length ? (
          <ol className="thoughts">
            {data.map((t) => (
              <Thought key={t.id} t={t} />
            ))}
          </ol>
        ) : (
          <Empty>还没有动态。站长今天很安静。</Empty>
        )}
      </Window>
    </SiteShell>
  )
}

type T = { id: number; html: string; up: number; down: number; createdAt: string | Date }

function Thought({ t }: { t: T }) {
  const qc = useQueryClient()
  const [voted, setVoted] = useState<"up" | "down" | null>(null)
  const react = async (kind: "up" | "down") => {
    try {
      const r = await unwrap(api.thoughts({ id: t.id }).react.post({ kind }))
      setVoted(kind)
      qc.setQueryData(thoughtsQuery().queryKey, (old) =>
        old?.map((x) => (x.id === t.id ? { ...x, up: r.up, down: r.down } : x)),
      )
      if (!r.counted) toast("你已经表过态了 ~")
    } catch (e) {
      toast.error(`没点上：${(e as Error).message}`)
    }
  }
  return (
    <li className="thought">
      <div className="prose" dangerouslySetInnerHTML={{ __html: t.html }} />
      <div className="thought-meta">
        <time dateTime={String(t.createdAt)} title={fullTime(t.createdAt)}>
          {timeAgo(t.createdAt)}
        </time>
        <button
          type="button"
          className="thought-vote"
          aria-pressed={voted === "up"}
          disabled={!!voted}
          onClick={() => react("up")}
        >
          顶 {t.up}
        </button>
        <button
          type="button"
          className="thought-vote"
          aria-pressed={voted === "down"}
          disabled={!!voted}
          onClick={() => react("down")}
        >
          踩 {t.down}
        </button>
      </div>
    </li>
  )
}
