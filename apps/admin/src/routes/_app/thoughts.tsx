import { createFileRoute } from "@tanstack/react-router"
import { thoughtInput } from "@driftlog/client"
import { CrudPage } from "@/components/crud-page"
import { api, formatTime, unwrap } from "@/lib/api"

export const Route = createFileRoute("/_app/thoughts")({
  component: () => (
    <CrudPage
      title="动态"
      description="比手记更短的碎片，博客的 /thinking。支持 Markdown"
      noun="动态"
      queryKey="admin-thoughts"
      list={() => unwrap(api.admin.thoughts.get())}
      create={(v) => unwrap(api.admin.thoughts.post(v as never))}
      remove={(id) => unwrap(api.admin.thoughts({ id }).delete())}
      schema={thoughtInput}
      fields={[{ name: "content", label: "内容", kind: "textarea" }]}
      columns={[
        { header: "内容", cell: (r) => <span className="line-clamp-3">{r.content}</span> },
        {
          header: "顶 / 踩",
          cell: (r) => (
            <span className="tabular">
              {r.up} / {r.down}
            </span>
          ),
          className: "whitespace-nowrap",
        },
        {
          header: "时间",
          cell: (r) => <span className="tabular text-muted-foreground">{formatTime(r.createdAt)}</span>,
          className: "whitespace-nowrap",
        },
      ]}
      empty="还没有动态。"
    />
  ),
})
