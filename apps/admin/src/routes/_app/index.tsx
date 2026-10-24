import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { api, formatBytes, unwrap } from "@/lib/api"
import { PageHeader, statsQuery } from "../_app"

export const Route = createFileRoute("/_app/")({ component: Dashboard })

const chartConfig = { n: { label: "评论", color: "var(--chart-1)" } } satisfies ChartConfig
const jobLabel: Record<string, string> = {
  active: "进行中",
  waiting: "排队",
  failed: "失败",
  completed: "完成",
  delayed: "延后",
}

function Dashboard() {
  const { data, isPending, isError } = useQuery(statsQuery)
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => unwrap(api.admin.jobs.get()),
    refetchInterval: 10_000,
  })

  // 最近 30 天，没有评论的日子补 0
  const [today] = useState(() => Date.now())
  const daily = useMemo(() => {
    const map = new Map(data?.daily.map((d) => [d.day, d.n]))
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today - (29 - i) * 86400_000)
      const day = d.toLocaleDateString("sv-SE")
      return { day: day.slice(5), n: map.get(day) ?? 0 }
    })
  }, [data, today])

  const count = (t: string) => data?.byType.find((x) => x.type === t)?.n ?? 0
  const views = data?.byType.reduce((s, x) => s + x.views, 0) ?? 0
  const cards = [
    { label: "文章", value: count("post"), to: "/entries", search: { type: "post" } },
    { label: "手记", value: count("note"), to: "/entries", search: { type: "note" } },
    { label: "总阅读", value: views.toLocaleString() },
    {
      label: "待审核评论",
      value: data?.pendingComments ?? 0,
      to: "/comments",
      search: { status: "pending" },
    },
    {
      label: "文件",
      value: data ? `${data.files.count} · ${formatBytes(data.files.bytes)}` : 0,
      to: "/files",
    },
  ]

  return (
    <>
      <PageHeader title="概览" description="最近 30 天的情况" />
      {isError && <p className="mb-4 text-sm text-destructive">统计没加载出来，刷新一下试试。</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="tabular text-2xl">
                {isPending ? (
                  <Skeleton className="h-8 w-16" />
                ) : c.to ? (
                  <Link to={c.to} search={c.search as never} className="hover:underline">
                    {c.value}
                  </Link>
                ) : (
                  c.value
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>评论</CardTitle>
            <CardDescription>每天收到的评论数</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <AreaChart data={daily} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="n"
                  type="monotone"
                  stroke="var(--color-n)"
                  fill="var(--color-n)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>阅读最多</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.top.length ? (
                <ol className="grid gap-2 text-sm">
                  {data.top.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3">
                      <Link
                        to="/entries/$id"
                        params={{ id: String(e.id) }}
                        className="truncate hover:underline"
                      >
                        {e.title}
                      </Link>
                      <span className="tabular shrink-0 text-muted-foreground">
                        {e.views.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">还没有阅读数据。</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>后台任务</CardTitle>
              <CardDescription>BullMQ 队列 · AI {data?.aiEnabled ? "已开启" : "未配置"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {jobs.data ? (
                Object.entries(jobs.data).map(([k, v]) => (
                  <Badge
                    key={k}
                    variant={k === "failed" && v ? "destructive" : "secondary"}
                    className="tabular"
                  >
                    {jobLabel[k] ?? k} {v}
                  </Badge>
                ))
              ) : (
                <Skeleton className="h-5 w-40" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
