import { createFileRoute } from "@tanstack/react-router"
import { sayInput } from "@driftlog/client"
import { CrudPage } from "@/components/crud-page"
import { api, unwrap } from "@/lib/api"

export const Route = createFileRoute("/_app/says")({
  component: () => (
    <CrudPage
      title="一言"
      description="在别处看到、想记下来的句子。博客首页每天换一句"
      noun="一言"
      queryKey="admin-says"
      list={() => unwrap(api.admin.says.get())}
      create={(v) => unwrap(api.admin.says.post(v as never))}
      remove={(id) => unwrap(api.admin.says({ id }).delete())}
      schema={sayInput}
      fields={[
        { name: "text", label: "句子", kind: "textarea" },
        { name: "author", label: "作者（可不填）", nullable: true },
        { name: "source", label: "出处链接（可不填）", kind: "url", nullable: true },
      ]}
      columns={[
        { header: "句子", cell: (r) => <span className="line-clamp-3 whitespace-pre-line">{r.text}</span> },
        { header: "作者", cell: (r) => r.author ?? "—" },
      ]}
      empty="还没有收集句子。"
    />
  ),
})
