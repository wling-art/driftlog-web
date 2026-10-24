import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import { Check, X } from "lucide-react"
import { linkInput } from "@driftlog/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CrudPage } from "@/components/crud-page"
import { api, unwrap } from "@/lib/api"

const stateLabel = { approved: "已通过", pending: "待审核", outdated: "失效", rejected: "拒绝" } as const
const typeLabel = { friend: "友链", collection: "收藏" } as const
const setState = (id: number, state: "approved" | "rejected") =>
  unwrap(api.admin.links({ id }).patch({ state }))
const showError = (e: Error) => toast.error(e.message)

export const Route = createFileRoute("/_app/links")({
  component: () => (
    <CrudPage
      title="友链"
      description="读者在博客 /friends 申请的会进「待审核」，通过后才显示"
      noun="友链"
      queryKey="admin-links"
      list={async () => (await unwrap(api.admin.links.get())).items}
      create={(v) => unwrap(api.admin.links.post(v as never))}
      update={(id, v) => unwrap(api.admin.links({ id }).patch(v as never))}
      remove={(id) => unwrap(api.admin.links({ id }).delete())}
      schema={linkInput}
      fields={[
        { name: "name", label: "站名" },
        { name: "url", label: "网址", kind: "url" },
        { name: "avatar", label: "头像地址", kind: "url", nullable: true },
        { name: "description", label: "一句话介绍" },
        { name: "email", label: "邮箱", nullable: true },
        {
          name: "type",
          label: "类型",
          kind: "select",
          options: Object.entries(typeLabel).map(([value, label]) => ({ value, label })),
        },
        {
          name: "state",
          label: "状态",
          kind: "select",
          options: Object.entries(stateLabel).map(([value, label]) => ({ value, label })),
        },
      ]}
      columns={[
        {
          header: "站点",
          cell: (r) => (
            <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
              {r.name}
            </a>
          ),
        },
        { header: "介绍", cell: (r) => <span className="text-muted-foreground">{r.description}</span> },
        {
          header: "状态",
          cell: (r) => (
            <Badge
              variant={
                r.state === "approved" ? "secondary" : r.state === "pending" ? "outline" : "destructive"
              }
            >
              {typeLabel[r.type]} · {stateLabel[r.state]}
            </Badge>
          ),
          className: "whitespace-nowrap",
        },
      ]}
      rowActions={(r, refresh) =>
        r.state === "pending" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setState(r.id, "approved").then(() => {
                  toast.success(`通过了「${r.name}」`)
                  refresh()
                }, showError)
              }
            >
              <Check /> 通过
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="拒绝"
              onClick={() => setState(r.id, "rejected").then(refresh, showError)}
            >
              <X />
            </Button>
          </>
        )
      }
      empty="还没有友链。"
    />
  ),
})
