import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Languages, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
import { api, formatTime, unwrap } from "@/lib/api"
import { PageHeader } from "../_app"

export const Route = createFileRoute("/_app/translations")({ component: Translations })

const typeLabel = { post: "文章", note: "手记", page: "页面" } as const
type EntryType = keyof typeof typeLabel

type Overview = Awaited<ReturnType<typeof loadOverview>>
type Item = Overview["items"][number]

const loadOverview = () => unwrap(api.admin.translations.get())
const run = (id: number, lang: string) => unwrap(api.admin.translations({ id })({ lang }).run.post())

function Translations() {
  const qc = useQueryClient()
  const [type, setType] = useState<"all" | EntryType>("all")
  const [open, setOpen] = useState<{ item: Item; lang: string } | null>(null)
  // 有译文在排队或翻译时每 3 秒刷新一次
  const { data, isLoading } = useQuery({
    queryKey: ["translations"],
    queryFn: loadOverview,
    refetchInterval: (q) =>
      q.state.data?.items.some((i) => Object.values(i.jobs).some((j) => j.state !== "failed")) ? 3000 : false,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ["translations"] })
  const runOne = useMutation({
    mutationFn: ({ id, lang }: { id: number; lang: string }) => run(id, lang),
    onSuccess: () => {
      toast("已排队，翻译完成后这里会更新")
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const runMissing = useMutation({
    mutationFn: () => unwrap(api.admin.translations["run-missing"].post()),
    onSuccess: (r) => {
      toast(r.queued ? `排了 ${r.queued} 条翻译` : "没有缺失的译文")
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const items = data?.items.filter((i) => type === "all" || i.type === type) ?? []
  const langs = data?.languages ?? []

  return (
    <>
      <PageHeader title="翻译" description="每篇内容的各语言译文：查看、手动修改，或让 AI 重新翻译" />
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">自动翻译</span>
              {data?.enabled ? (
                <Badge variant="secondary">已开启</Badge>
              ) : (
                <Badge variant="outline">未开启</Badge>
              )}
              {data && !data.enabled && (
                <Link to="/settings" className="text-muted-foreground underline underline-offset-4">
                  去「设置」里配置
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">目标语言</span>
              {langs.length ? (
                langs.map((l) => (
                  <Badge key={l} variant="outline" className="font-mono">
                    {l}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">还没有</span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            disabled={runMissing.isPending || !data?.enabled}
            onClick={() => runMissing.mutate()}
          >
            <Languages /> 翻译所有缺失的
          </Button>
        </CardContent>
      </Card>

      <Tabs value={type} onValueChange={(v) => setType(v as typeof type)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          {(Object.keys(typeLabel) as EntryType[]).map((t) => (
            <TabsTrigger key={t} value={t}>
              {typeLabel[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="text-xs font-medium text-muted-foreground">标题</TableHead>
              {langs.map((l) => (
                <TableHead key={l} className="font-mono text-xs font-medium text-muted-foreground">
                  {l}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-72">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {typeLabel[item.type]}
                      </Badge>
                      <span className={item.published ? "truncate" : "truncate text-muted-foreground"}>
                        {item.title}
                      </span>
                      {!item.published && (
                        <span className="shrink-0 text-xs text-muted-foreground">草稿</span>
                      )}
                    </div>
                  </TableCell>
                  {langs.map((lang) => (
                    <TableCell key={lang}>
                      <Cell
                        item={item}
                        lang={lang}
                        busy={runOne.isPending}
                        onRun={() => runOne.mutate({ id: item.id, lang })}
                        onOpen={() => setOpen({ item, lang })}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={langs.length + 1}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {isLoading ? "加载中…" : "没有内容"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {open && (
            <TranslationEditor
              key={`${open.item.id}:${open.lang}`}
              item={open.item}
              lang={open.lang}
              onDone={() => {
                setOpen(null)
                refresh()
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

/** 一格：状态 + 操作 */
function Cell({
  item,
  lang,
  busy,
  onRun,
  onOpen,
}: {
  item: Item
  lang: string
  busy: boolean
  onRun: () => void
  onOpen: () => void
}) {
  const t = item.translations[lang]
  const job = item.jobs[lang]
  const working = job?.state === "waiting" || job?.state === "active"
  const status = (() => {
    if (job?.state === "active")
      return (
        <Badge variant="secondary">
          <Loader2 className="animate-spin" /> 翻译中
        </Badge>
      )
    if (job?.state === "waiting") return <Badge variant="secondary">排队中</Badge>
    if (job?.state === "failed")
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive">失败</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-80">{job.error || "没有错误信息"}</TooltipContent>
        </Tooltip>
      )
    if (!t) return <Badge variant="outline">未翻译</Badge>
    if (t.stale) return <Badge variant="outline">已过期</Badge>
    return <Badge variant="secondary">已翻译</Badge>
  })()
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        {status}
        {t && <span className="tabular text-xs text-muted-foreground">{formatTime(t.updatedAt)}</span>}
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" disabled={working || busy} onClick={onRun}>
          {t ? <RefreshCw /> : <Languages />} {t ? "重新翻译" : "翻译"}
        </Button>
        {t && (
          <Button size="sm" variant="ghost" onClick={onOpen}>
            查看/编辑
          </Button>
        )}
      </div>
    </div>
  )
}

/** 抽屉里的译文：能改 Markdown 就给编辑框，旧译文只有 HTML 就只读预览 */
function TranslationEditor({ item, lang, onDone }: { item: Item; lang: string; onDone: () => void }) {
  const { data, error } = useQuery({
    queryKey: ["translation", item.id, lang],
    queryFn: () => unwrap(api.admin.translations({ id: item.id })({ lang }).get()),
  })
  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {item.title} <span className="font-mono text-sm text-muted-foreground">· {lang}</span>
        </SheetTitle>
        <SheetDescription>
          {data ? (data.model ? `由 ${data.model} 翻译` : "手动编辑过或导入的译文") : "加载中…"}
        </SheetDescription>
      </SheetHeader>
      {error && <p className="px-4 text-sm text-destructive">{error.message}</p>}
      {data && (
        <EditorBody
          // 数据变了就重置表单
          key={`${data.title}\n${data.body}`}
          id={item.id}
          lang={lang}
          data={data}
          onDone={onDone}
        />
      )}
    </>
  )
}

function EditorBody({
  id,
  lang,
  data,
  onDone,
}: {
  id: number
  lang: string
  data: { title: string; body: string; html: string; editable: boolean }
  onDone: () => void
}) {
  const [title, setTitle] = useState(data.title)
  const [body, setBody] = useState(data.body)
  const [confirm, setConfirm] = useState(false)
  const save = useMutation({
    mutationFn: () => unwrap(api.admin.translations({ id })({ lang }).put({ title, body })),
    onSuccess: () => {
      toast.success("译文已保存")
      onDone()
    },
    onError: (e: Error) => toast.error(`没保存上：${e.message}`),
  })
  const remove = useMutation({
    mutationFn: () => unwrap(api.admin.translations({ id })({ lang }).delete()),
    onSuccess: () => {
      toast("译文已删除")
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <div className="grid gap-4 px-4 pb-4">
      <div className="grid gap-1.5">
        <Label htmlFor="tr-title">标题</Label>
        <Input id="tr-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      {data.editable ? (
        <div className="grid gap-1.5">
          <Label htmlFor="tr-body">正文（Markdown）</Label>
          <Textarea
            id="tr-body"
            className="min-h-96 font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label>正文预览</Label>
          <p className="text-xs text-muted-foreground">导入的旧译文没有 Markdown 原文，重新翻译后可以编辑</p>
          {/* 服务端渲染的 HTML，来源和 markdown-preview 一样可信 */}
          <div className="md-preview rounded-md border p-3" dangerouslySetInnerHTML={{ __html: data.html }} />
        </div>
      )}
      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setConfirm(true)} disabled={remove.isPending}>
          删除译文
        </Button>
        {data.editable && (
          <Button onClick={() => save.mutate()} disabled={save.isPending || !title.trim() || !body.trim()}>
            {save.isPending ? "保存中…" : "保存"}
          </Button>
        )}
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这份 {lang} 译文？</AlertDialogTitle>
            <AlertDialogDescription>博客上的这个语言版本会消失，之后可以重新翻译。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
