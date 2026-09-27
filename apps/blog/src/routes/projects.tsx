import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Window } from "@/components/boring"
import { BackLink, Empty, SiteShell } from "@/components/site"
import { projectsQuery } from "@/lib/api"
import { siteOf } from "@/lib/site"

export const Route = createFileRoute("/projects")({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery()),
  head: ({ matches }) => ({ meta: [{ title: `项目 · ${siteOf(matches).title}` }] }),
  component: Projects,
})

/** 项目：一个项目一张卡片（标签 → 名字 → 一句话 → 链接），有详细介绍的可以展开 */
function Projects() {
  const { data } = useSuspenseQuery(projectsQuery())
  return (
    <SiteShell>
      <Window
        id="projects"
        name="projects/"
        title="项目"
        rule={`// 做过的东西 · ${data.length} 个`}
        lead={<BackLink to="/" label="首页" />}
        closable={false}
      >
        {data.length ? (
          <ul className="card-grid">
            {data.map((p) => (
              <li key={p.id} className="card">
                <span className="pixel-1 muted">project</span>
                <h3 className="card-title">{p.name}</h3>
                {p.description && <p className="card-desc">{p.description}</p>}
                {p.html && (
                  <details className="card-more">
                    <summary>看介绍</summary>
                    <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
                  </details>
                )}
                <p className="card-links">
                  {p.previewUrl && (
                    <a href={p.previewUrl} target="_blank" rel="noopener">
                      打开
                    </a>
                  )}
                  {p.projectUrl && (
                    <a href={p.projectUrl} target="_blank" rel="noopener">
                      源码
                    </a>
                  )}
                  {p.docUrl && (
                    <a href={p.docUrl} target="_blank" rel="noopener">
                      文档
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>还没有项目。在憋大招。</Empty>
        )}
      </Window>
    </SiteShell>
  )
}
