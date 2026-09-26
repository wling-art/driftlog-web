import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { API_URL, api, auth, formatBytes, unwrap } from "@/lib/api"
import { PageHeader } from "../_app"

export const Route = createFileRoute("/_app/settings")({ component: Settings })

function Settings() {
  const qc = useQueryClient()
  const backups = useQuery({ queryKey: ["backups"], queryFn: () => unwrap(api.admin.backups.get()) })
  const passkeys = auth.useListPasskeys()
  const backup = useMutation({
    mutationFn: () => unwrap(api.admin.backups.post()),
    onSuccess: () => {
      toast("备份已排队，几秒后刷新就能看到")
      setTimeout(() => qc.invalidateQueries({ queryKey: ["backups"] }), 4000)
    },
  })
  const addPasskey = async () => {
    const r = await auth.passkey.addPasskey({ name: navigator.platform || "这台设备" })
    if (r?.error) toast.error(r.error.message ?? "没加上")
    else toast.success("Passkey 加好了，下次可以直接用它登录")
  }

  return (
    <>
      <PageHeader title="设置" />
      <div className="grid items-start gap-6 xl:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Passkey</CardTitle>
            <CardDescription>用指纹、面容或安全密钥登录后台，不用记密码</CardDescription>
          </CardHeader>
          <CardContent>
            {passkeys.data?.length ? (
              <ul className="grid gap-2 text-sm">
                {passkeys.data.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <KeyRound className="size-4 text-muted-foreground" /> {p.name ?? "未命名"}
                    <span className="text-muted-foreground">
                      · {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">还没有 Passkey。</p>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={addPasskey}>
              <KeyRound /> 加一个 Passkey
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}
