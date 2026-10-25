import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, RotateCw, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api, formatTime, unwrap } from "@/lib/api"

const stateLabel: Record<string, string> = {
  active: "进行中",
  waiting: "排队中",
  delayed: "等待重试",
  failed: "失败",
  completed: "完成",
}
const jobLabel: Record<string, string> = {
  translate: "翻译",
  "entry.saved": "保存后处理",
  "comment.created": "评论处理",
}

const loadQueue = () => unwrap(api.admin.queue.get())

/** AI 队列：翻译任务的状态、失败原因，可以重试或移除 */
export function AiQueue() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ["ai-queue"],
    queryFn: loadQueue,
    // 有任务在跑时每 3 秒刷新
    refetchInterval: (q) => {
      const c = q.state.data?.counts
      return c && c.active + c.queued > 0 ? 3000 : 15000
    },
  })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["ai-queue"] })
    void qc.invalidateQueries({ queryKey: ["translations"] })
  }
  const retry = useMutation({
    mutationFn: (id: string) => unwrap(api.admin.queue({ id }).retry.post()),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.admin.queue({ id }).delete()),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })
  const c = data?.counts

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>队列</CardTitle>
        <CardDescription>
          {c
            ? `进行中 ${c.active} · 排队 ${c.queued} · 失败 ${c.failed} · 最近完成 ${c.completed}`
            : "加载中…"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data?.jobs.length ? (
          <ul className="divide-y rounded-md border text-sm">
            {data.jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <StateBadge state={j.state} />
                <span className="text-muted-foreground">{jobLabel[j.name] ?? j.name}</span>
                {j.lang && (
                  <Badge variant="outline" className="font-mono">
                    {j.lang}
                  </Badge>
                )}
                <span className="min-w-0 flex-1 truncate">
                  {j.title ?? (j.entryId ? `#${j.entryId}` : "")}
                </span>
                {j.state === "failed" && j.error && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="max-w-[16rem] truncate text-xs text-destructive">{j.error}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md break-words">{j.error}</TooltipContent>
                  </Tooltip>
                )}
                {j.attempts > 1 && <span className="text-xs text-muted-foreground">第 {j.attempts} 次</span>}
                <span className="tabular text-xs text-muted-foreground">
                  {formatTime(new Date(j.finishedAt ?? j.createdAt))}
                </span>
                {j.state === "failed" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="重试"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(j.id)}
                  >
                    <RotateCw />
                  </Button>
                )}
                {j.state !== "active" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="移除"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(j.id)}
                  >
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">队列是空的。</p>
        )}
      </CardContent>
    </Card>
  )
}

function StateBadge({ state }: { state: string }) {
  if (state === "active")
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="size-3 animate-spin" /> {stateLabel.active}
      </Badge>
    )
  return (
    <Badge variant={state === "failed" ? "destructive" : state === "completed" ? "outline" : "secondary"}>
      {stateLabel[state] ?? state}
    </Badge>
  )
}
