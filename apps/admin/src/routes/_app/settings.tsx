import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useForm } from "@tanstack/react-form"
import { siteSettingsInput, type SiteSettingsInput } from "@driftlog/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { API_URL, api, formatBytes, unwrap } from "@/lib/api"
import { PageHeader } from "../_app"

export const Route = createFileRoute("/_app/settings")({ component: Settings })

function Settings() {
  const qc = useQueryClient()
  const backups = useQuery({ queryKey: ["backups"], queryFn: () => unwrap(api.admin.backups.get()) })
  const backup = useMutation({
    mutationFn: () => unwrap(api.admin.backups.post()),
    onSuccess: () => {
      toast("备份已排队，几秒后刷新就能看到")
      setTimeout(() => qc.invalidateQueries({ queryKey: ["backups"] }), 4000)
    },
  })
  return (
    <>
      <PageHeader title="设置" />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <SiteCard />
        <Card>
          <CardHeader>
            <CardTitle>备份</CardTitle>
            <CardDescription>
              pg_dump + 本地文件打成 tar.gz，每天凌晨 4 点自动一份，放在服务端的 /data/backups
            </CardDescription>
          </CardHeader>
          <CardContent>
            {backups.data?.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {backups.data.slice(0, 10).map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate font-mono text-xs">{b.name}</span>
                    <span className="tabular shrink-0 text-muted-foreground">{formatBytes(b.size)}</span>
                    <Button size="icon" variant="ghost" className="size-8" asChild>
                      <a href={`${API_URL}/admin/backups/${b.name}`} aria-label={`下载 ${b.name}`}>
                        <Download />
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">还没有备份。</p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => backup.mutate()} disabled={backup.isPending}>
              现在备份一份
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}

const socialKeys = [
  { key: "github", label: "GitHub 用户名" },
  { key: "twitter", label: "X 用户名" },
  { key: "telegram", label: "Telegram 用户名" },
  { key: "bilibili", label: "哔哩哔哩 UID" },
  { key: "email", label: "公开邮箱" },
] as const

/** 站点设置：站名、简介、站长资料 */
function SiteCard() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ["site"], queryFn: () => unwrap(api.site.get()) })
  if (!data)
    return (
      <Card>
        <CardHeader>
          <CardTitle>站点</CardTitle>
          <CardDescription>加载中…</CardDescription>
        </CardHeader>
      </Card>
    )
  return (
    <SiteForm
      key={JSON.stringify(data)}
      initial={data}
      onSaved={() => qc.invalidateQueries({ queryKey: ["site"] })}
    />
  )
}

function SiteForm({ initial, onSaved }: { initial: SiteSettingsInput; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      title: initial.title,
      description: initial.description,
      keywords: initial.keywords.join(", "),
      name: initial.owner.name,
      introduce: initial.owner.introduce,
      avatar: initial.owner.avatar ?? "",
      ...Object.fromEntries(socialKeys.map((s) => [s.key, initial.owner.socials[s.key] ?? ""])),
    } as Record<string, string>,
    onSubmit: async ({ value }) => {
      const body = {
        title: value.title!,
        description: value.description!,
        keywords: value
          .keywords!.split(/[,，]/)
          .map((k) => k.trim())
          .filter(Boolean),
        owner: {
          name: value.name!,
          introduce: value.introduce!,
          avatar: value.avatar || null,
          socials: Object.fromEntries(
            socialKeys.map((s) => [s.key, value[s.key]!.trim()]).filter(([, v]) => v),
          ),
        },
      }
      const r = siteSettingsInput.safeParse(body)
      if (!r.success) return setError(r.error.issues.map((i) => i.message).join("；"))
      setError(null)
      try {
        await unwrap(api.admin.site.put(r.data))
        toast.success("站点设置已保存，博客马上生效")
        onSaved()
      } catch (e) {
        toast.error(`没保存上：${(e as Error).message}`)
      }
    },
  })
  const text = (name: string, label: string, hint?: string, area?: boolean) => (
    <form.Field key={name} name={name}>
      {(f) => (
        <div className="grid gap-1.5">
          <Label htmlFor={`site-${name}`}>{label}</Label>
          {area ? (
            <Textarea
              id={`site-${name}`}
              rows={3}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          ) : (
            <Input
              id={`site-${name}`}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      )}
    </form.Field>
  )
  return (
    <Card className="xl:row-span-2">
      <CardHeader>
        <CardTitle>站点</CardTitle>
        <CardDescription>博客的站名、首页介绍、订阅源、搜索引擎看到的描述都来自这里</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          {text("title", "站名")}
          {text("description", "一句话简介")}
          {text("keywords", "关键词", "用逗号分开")}
          <div className="grid gap-4 border-t pt-4">
            {text("name", "站长名字")}
            {text("introduce", "站长介绍", "显示在博客首页", true)}
            {text("avatar", "头像地址")}
            <div className="grid gap-4 sm:grid-cols-2">{socialKeys.map((s) => text(s.key, s.label))}</div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(busy) => (
              <Button type="submit" disabled={busy}>
                {busy ? "保存中…" : "保存站点设置"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}
