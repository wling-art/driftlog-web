import { useRef } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { toast } from "sonner"
import { Copy, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, formatBytes, formatTime, unwrap } from "@/lib/api"
import { PageHeader } from "../_app"

export const Route = createFileRoute("/_app/files")({
  validateSearch: z.object({ orphan: z.boolean().default(false), page: z.number().int().min(1).default(1) }),
  component: Files,
})

const PAGE = 40

function Files() {
  const { orphan, page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const { data, isPending } = useQuery({
    queryKey: ["admin-files", orphan, page],
    queryFn: () => unwrap(api.admin.files.get({ query: { orphan: orphan || undefined, page, size: PAGE } })),
    placeholderData: keepPreviousData,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-files"] })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await unwrap(api.admin.files.post({ file }))
    },
    onSuccess: (_, files) => {
      toast.success(`传好了 ${files.length} 个文件`)
      refresh()
    },
    onError: (e) => toast.error(`上传失败：${e.message}`),
  })
  const remove = useMutation({
    mutationFn: (id: number) => unwrap(api.admin.files({ id }).delete()),
    onSuccess: refresh,
  })
  const purge = useMutation({
    mutationFn: () => unwrap(api.admin.files["purge-orphans"].post()),
    onSuccess: (r) => {
      toast.success(`清掉了 ${r.deleted} 个没人用的文件`)
      refresh()
    },
  })
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE))

  return (
    <>
      <PageHeader
        title="文件"
        description="按内容哈希去重；图片自动转 WebP、去 EXIF、出多尺寸。每天凌晨标一次没人引用的文件"
        actions={
          <>
            {orphan && !!data?.total && (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => purge.mutate()}
                disabled={purge.isPending}
              >
                <Trash2 /> 清理 {data.total} 个孤儿文件
              </Button>
            )}
            <Button onClick={() => input.current?.click()} disabled={upload.isPending}>
              <Upload /> {upload.isPending ? "上传中…" : "上传"}
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              accept="image/*,video/mp4,video/webm,application/pdf"
              onChange={(e) => e.target.files && upload.mutate([...e.target.files])}
            />
          </>
        }
      />
      <Tabs
        value={orphan ? "orphan" : "all"}
        onValueChange={(v) => navigate({ search: { orphan: v === "orphan", page: 1 } })}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="orphan">孤儿文件</TabsTrigger>
        </TabsList>
      </Tabs>
      {!isPending && !data?.items.length && (
        <p className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          {orphan ? "没有孤儿文件。" : "还没传过文件。可以直接把图片粘贴进编辑器。"}
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {data?.items.map((f) => (
          <figure key={f.id} className="group overflow-hidden rounded-lg border">
            <div
              className="relative aspect-[4/3] bg-muted"
              style={
                f.thumbhash ? { backgroundImage: `url(${f.thumbhash})`, backgroundSize: "cover" } : undefined
              }
            >
              {f.mime.startsWith("image/") ? (
                <img
                  src={f.variants[0]?.url ?? f.url}
                  alt={f.name}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center font-mono text-xs text-muted-foreground">
                  {f.mime}
                </span>
              )}
              {f.refs === 0 && (
                <Badge variant="outline" className="absolute top-2 left-2 bg-background">
                  没被引用
                </Badge>
              )}
            </div>
            <figcaption className="grid gap-1 p-2.5 text-xs">
              <span className="truncate font-medium" title={f.name}>
                {f.name}
              </span>
              <span className="tabular text-muted-foreground">
                {f.width ? `${f.width}×${f.height} · ` : ""}
                {formatBytes(f.size)} · {formatTime(f.createdAt)}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(`![${f.name}](${f.url})`)
                      .then(() => toast("已复制 Markdown"))
                  }
                >
                  <Copy /> 复制
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive"
                  aria-label={`删除 ${f.name}`}
                  onClick={() => remove.mutate(f.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {pages > 1 && (
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ search: { orphan, page: page - 1 } })}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => navigate({ search: { orphan, page: page + 1 } })}
          >
            下一页
          </Button>
        </div>
      )}
    </>
  )
}
