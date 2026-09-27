import { useMemo } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import { z } from "zod"
import { toast } from "sonner"
import { Check, ShieldAlert, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, features } from "@/components/data-table"
import { api, blogPath, formatTime, unwrap } from "@/lib/api"
import { PageHeader } from "../_app"

const statuses = { pending: "待审核", approved: "已通过", spam: "垃圾" } as const
type Status = keyof typeof statuses

export const Route = createFileRoute("/_app/comments")({
  validateSearch: z.object({
    status: z.enum(["pending", "approved", "spam", "all"]).default("pending"),
    page: z.number().int().min(1).default(1),
  }),
  component: Comments,
})

const PAGE = 20
const fetchPage = (status: Status | "all", page: number) =>
  unwrap(
    api.admin.comments.get({ query: { status: status === "all" ? undefined : status, page, size: PAGE } }),
  )
type Row = Awaited<ReturnType<typeof fetchPage>>["items"][number]
const EMPTY: Row[] = []
const helper = createColumnHelper<typeof features, Row>()

function Comments() {
  const { status, page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qc = useQueryClient()
  const { data, isFetching } = useQuery({
    queryKey: ["admin-comments", status, page],
    queryFn: () => fetchPage(status, page),
    placeholderData: keepPreviousData,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-comments"] })
    qc.invalidateQueries({ queryKey: ["stats"] })
  }
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Status }) =>
      unwrap(api.admin.comments({ id }).patch({ status })),
    onSuccess: (_, v) => {
      toast.success(v.status === "approved" ? "已通过" : "已标为垃圾")
      refresh()
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: number) => unwrap(api.admin.comments({ id }).delete()),
    onSuccess: () => {
      toast.success("已删除")
      refresh()
    },
  })

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("author", {
          header: "作者",
          cell: (c) => (
            <div className="flex items-center gap-2">
              <img src={c.row.original.avatar} alt="" className="size-7 rounded-full" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium">
                  {c.getValue()}
                  {c.row.original.private && <Badge variant="outline">悄悄话</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.row.original.email}
                  {c.row.original.location && ` · ${c.row.original.location}`}
                </div>
              </div>
            </div>
          ),
        }),
        helper.accessor("body", {
          header: "内容",
          cell: (c) => <p className="line-clamp-3 max-w-xl whitespace-pre-wrap text-sm">{c.getValue()}</p>,
        }),
        helper.accessor((r) => r.entry.title, {
          id: "entry",
          header: "文章",
          cell: (c) => (
            <a
              className="text-link hover:underline"
              href={`${blogPath(c.row.original.entry.type, c.row.original.entry.slug)}#comment-${c.row.original.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {c.getValue()}
            </a>
          ),
        }),
        helper.accessor("status", {
          header: "状态",
          cell: (c) => (
            <Badge
              variant={
                c.getValue() === "spam" ? "destructive" : c.getValue() === "pending" ? "outline" : "secondary"
              }
            >
              {statuses[c.getValue()]}
            </Badge>
          ),
        }),
        helper.accessor("createdAt", {
          header: "时间",
          cell: (c) => (
            <span className="tabular whitespace-nowrap text-muted-foreground">
              {formatTime(c.getValue())}
            </span>
          ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">操作</span>,
          cell: (c) => {
            const r = c.row.original
            return (
              <div className="flex justify-end gap-1">
                {r.status !== "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus.mutate({ id: r.id, status: "approved" })}
                  >
                    <Check /> 通过
                  </Button>
                )}
                {r.status !== "spam" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="标为垃圾"
                    onClick={() => setStatus.mutate({ id: r.id, status: "spam" })}
                  >
                    <ShieldAlert />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive"
                  aria-label="删除"
                  onClick={() => remove.mutate(r.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            )
          },
        }),
      ]),
    [setStatus, remove],
  )

  return (
    <>
      <PageHeader title="评论" description="配了 AI 时新评论会自动审核；没配时直接通过" />
      <Tabs
        value={status}
        onValueChange={(v) => navigate({ search: { status: v as Status, page: 1 } })}
        className="mb-4"
      >
        <TabsList>
          {Object.entries(statuses).map(([k, v]) => (
            <TabsTrigger key={k} value={k}>
              {v}
            </TabsTrigger>
          ))}
          <TabsTrigger value="all">全部</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={data?.items ?? EMPTY}
        loading={isFetching && !data}
        empty={status === "pending" ? "没有待审核的评论，清净。" : "这里是空的。"}
        page={page}
        pageSize={PAGE}
        total={data?.total ?? 0}
        onPage={(p) => navigate({ search: { status, page: p } })}
      />
    </>
  )
}
