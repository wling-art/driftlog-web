import { createFileRoute } from "@tanstack/react-router"
import { projectInput } from "@driftlog/client"
import { CrudPage } from "@/components/crud-page"
import { api, unwrap } from "@/lib/api"

export const Route = createFileRoute("/_app/projects")({
  component: () => (
    <CrudPage
      title="项目"
      description="博客的 /projects，一个项目一张卡片"
      noun="项目"
      queryKey="admin-projects"
      list={() => unwrap(api.admin.projects.get())}
      create={(v) => unwrap(api.admin.projects.post(v as never))}
      update={(id, v) => unwrap(api.admin.projects({ id }).patch(v as never))}
      remove={(id) => unwrap(api.admin.projects({ id }).delete())}
      schema={projectInput}
      fields={[
        { name: "name", label: "名字" },
        { name: "description", label: "一句话介绍" },
        { name: "previewUrl", label: "打开地址", kind: "url", nullable: true },
        { name: "projectUrl", label: "源码地址", kind: "url", nullable: true },
        { name: "docUrl", label: "文档地址", kind: "url", nullable: true },
        { name: "avatar", label: "图标地址", kind: "url", nullable: true },
        { name: "body", label: "详细介绍（Markdown，可不填）", kind: "textarea" },
        { name: "sort", label: "排序", kind: "number", hint: "小的在前" },
      ]}
      columns={[
        { header: "名字", cell: (r) => <span className="font-medium">{r.name}</span> },
        { header: "介绍", cell: (r) => <span className="text-muted-foreground">{r.description}</span> },
        {
          header: "链接",
          cell: (r) =>
            r.projectUrl ? (
              <a className="text-link hover:underline" href={r.projectUrl} target="_blank" rel="noreferrer">
                源码
              </a>
            ) : (
              "—"
            ),
        },
      ]}
      empty="还没有项目。"
    />
  ),
})
