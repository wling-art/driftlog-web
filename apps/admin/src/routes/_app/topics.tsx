import { createFileRoute } from "@tanstack/react-router"
import { topicInput } from "@driftlog/client"
import { CrudPage } from "@/components/crud-page"
import { api, unwrap } from "@/lib/api"

export const Route = createFileRoute("/_app/topics")({
  component: () => (
    <CrudPage
      title="手记专栏"
      description="手记按专栏归类，博客上的手记页把专栏做成文件夹"
      noun="专栏"
      queryKey="admin-topics"
      list={() => unwrap(api.admin.topics.get())}
      create={(v) => unwrap(api.admin.topics.post(v as never))}
      update={(id, v) => unwrap(api.admin.topics({ id }).patch(v as never))}
      remove={(id) => unwrap(api.admin.topics({ id }).delete())}
      schema={topicInput}
      fields={[
        { name: "name", label: "名字" },
        { name: "slug", label: "Slug", hint: "网址里的名字：/notes?topic=slug" },
        { name: "introduce", label: "一句话介绍" },
        { name: "description", label: "详细说明", kind: "textarea" },
        { name: "sort", label: "排序", kind: "number", hint: "小的在前" },
      ]}
      columns={[
        { header: "名字", cell: (r) => <span className="font-medium">{r.name}</span> },
        {
          header: "Slug",
          cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.slug}</span>,
        },
        {
          header: "介绍",
          cell: (r) => <span className="line-clamp-2 text-muted-foreground">{r.introduce}</span>,
        },
      ]}
      empty="还没有专栏。"
    />
  ),
})
