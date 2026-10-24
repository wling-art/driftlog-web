import { useMemo, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import { z } from "zod"
import { toast } from "sonner"
import { MoreHorizontal, Pin, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DataTable, features } from "@/components/data-table"
import { api, blogPath, formatTime, unwrap } from "@/lib/api"
import { PageHeader } from "../../_app"

const typeLabel = { post: "文章", note: "手记", page: "页面" } as const
type EntryType = keyof typeof typeLabel

export const Route = createFileRoute("/_app/entries/")({
  validateSearch: z.object({
    type: z.enum(["post", "note", "page"]).default("post"),
    page: z.number().int().min(1).default(1),
  }),
  component: Entries,
})

const PAGE = 20
const listQuery = (type: EntryType, page: number) => ({
  queryKey: ["admin-entries", type, page],
  queryFn: () => unwrap(api.admin.entries.get({ query: { type, page, size: PAGE } })),
})
type Row = Awaited<ReturnType<ReturnType<typeof listQuery>["queryFn"]>>["items"][number]
const EMPTY: Row[] = []
const helper = createColumnHelper<typeof features, Row>()

function Entries() {
  const { type, page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qc = useQueryClient()
  const { data, isFetching } = useQuery({ ...listQuery(type, page), placeholderData: keepPreviousData })
  const [deleting, setDeleting] = useState<Row | null>(null)

  const remove = useMutation({
    mutationFn: (id: number) => unwrap(api.admin.entries({ id }).delete()),
    onSuccess: () => {
      toast.success("已删除")
      qc.invalidateQueries({ queryKey: ["admin-entries"] })
      qc.invalidateQueries({ queryKey: ["stats"] })
    },
    onError: (e) => toast.error(`删除失败：${e.message}`),
  })

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("title", {
          header: "标题",
          cell: (c) => (
            <Link
              to="/entries/$id"
              params={{ id: String(c.row.original.id) }}
              className="flex items-center gap-2 font-medium hover:underline"
            >
              {c.row.original.pinned && <Pin className="size-3.5 text-muted-foreground" aria-label="置顶" />}
              {c.getValue()}
            </Link>
          ),
        }),
        helper.accessor("slug", {
          header: "Slug",
          cell: (c) => <span className="font-mono text-xs text-muted-foreground">{c.getValue()}</span>,
        }),
        helper.accessor("published", {
          header: "状态",
          cell: (c) =>
            c.getValue() ? (
              <Badge variant="secondary" className="text-success">
                ● 已发布
              </Badge>
            ) : (
              <Badge variant="outline">草稿</Badge>
            ),
        }),
        helper.accessor((r) => r.category?.name ?? "—", { id: "category", header: "分类" }),
        helper.accessor("views", {
          header: () => <span className="block text-right">阅读</span>,
          cell: (c) => <span className="tabular block text-right">{c.getValue()}</span>,
        }),
        helper.accessor("updatedAt", {
          header: "更新",
          cell: (c) => <span className="tabular text-muted-foreground">{formatTime(c.getValue())}</span>,
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">操作</span>,
          cell: (c) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="更多操作">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/entries/$id" params={{ id: String(c.row.original.id) }}>
                    编辑
                  </Link>
                </DropdownMenuItem>
                {c.row.original.published && (
                  <DropdownMenuItem asChild>
                    <a
                      href={blogPath(c.row.original.type, c.row.original.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      在博客打开
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c.row.original)}>
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [],
  )

  return (
    <>
      <PageHeader
        title={typeLabel[type]}
        description={`共 ${data?.total ?? "…"} 篇`}
        actions={
          <Button asChild>
            <Link to="/entries/$id" params={{ id: "new" }} search={{ type }}>
              <Plus /> 写{typeLabel[type]}
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data?.items ?? EMPTY}
        loading={isFetching && !data}
        empty={`还没有${typeLabel[type]}。点右上角写第一篇。`}
        page={page}
        pageSize={PAGE}
        total={data?.total ?? 0}
        onPage={(p) => navigate({ search: { type, page: p } })}
      />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{deleting?.title}」？</AlertDialogTitle>
            <AlertDialogDescription>
              它的评论、翻译会一起删掉，没法恢复。引用的图片会在下次孤儿检测时标出来。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && remove.mutate(deleting.id)}>
              删除这篇
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
