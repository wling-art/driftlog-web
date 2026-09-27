import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Window } from "@/components/boring"
import { BackLink, Empty, SiteShell } from "@/components/site"
import { saysQuery } from "@/lib/api"
import { siteOf } from "@/lib/site"

export const Route = createFileRoute("/says")({
  loader: ({ context }) => context.queryClient.ensureQueryData(saysQuery()),
  head: ({ matches }) => ({ meta: [{ title: `一言 · ${siteOf(matches).title}` }] }),
  component: Says,
})

function Says() {
  const { data } = useSuspenseQuery(saysQuery())
  return (
    <SiteShell scene="read">
      <Window
        id="says"
        name="says.txt"
        title="一言"
        rule="// 在别处看到、想记下来的句子"
        lead={<BackLink to="/" label="首页" />}
        closable={false}
      >
        {data.length ? (
          <ul className="says">
            {data.map((s) => (
              <li key={s.id} className="say">
                <blockquote>{s.text}</blockquote>
                {(s.author || s.source) && (
                  <figcaption>
                    —— {s.author}
                    {s.source && (
                      <>
                        {" "}
                        <a href={s.source} target="_blank" rel="noopener">
                          出处
                        </a>
                      </>
                    )}
                  </figcaption>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>还没收集到句子。</Empty>
        )}
      </Window>
    </SiteShell>
  )
}
