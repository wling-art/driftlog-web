import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, auth, unwrap } from "@/lib/api"
import { PageHeader } from "../_app"

export const Route = createFileRoute("/_app/account")({ component: Account })

function Account() {
  return (
    <>
      <PageHeader title="账号" />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
        <LinkedCard />
        <PasskeyCard />
      </div>
    </>
  )
}

const errorOf = (r: { error?: { message?: string } | null } | undefined) => r?.error?.message

function ProfileCard() {
  const qc = useQueryClient()
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => unwrap(api.admin.me.get()) })
  const [name, setName] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      const r = await auth.updateUser({ name: (name ?? me?.name ?? "").trim() })
      if (errorOf(r)) throw new Error(errorOf(r))
    },
    onSuccess: () => {
      toast.success("已保存")
      void qc.invalidateQueries({ queryKey: ["me"] })
    },
    onError: (e) => toast.error(e.message),
  })
  if (!me) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>资料</CardTitle>
        <CardDescription>登录邮箱不能在这里改</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="acc-email">邮箱</Label>
          <Input id="acc-email" value={me.email} disabled />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="acc-name">名字</Label>
          <Input id="acc-name" value={name ?? me.name} onChange={(e) => setName(e.target.value)} />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !(name ?? me.name).trim()}>
          保存
        </Button>
      </CardFooter>
    </Card>
  )
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "填现在的密码"),
    next: z.string().min(8, "新密码至少 8 位"),
    again: z.string(),
  })
  .refine((v) => v.next === v.again, { path: ["again"], message: "两次输入不一样" })

function PasswordCard() {
  const form = useForm({
    defaultValues: { current: "", next: "", again: "" },
    validators: { onChange: passwordSchema },
    onSubmit: async ({ value, formApi }) => {
      const r = await auth.changePassword({
        currentPassword: value.current,
        newPassword: value.next,
        revokeOtherSessions: true,
      })
      if (errorOf(r)) return void toast.error(errorOf(r))
      toast.success("密码已改，其他设备需要重新登录")
      formApi.reset()
    },
  })
  const fields = [
    ["current", "现在的密码", "current-password"],
    ["next", "新密码", "new-password"],
    ["again", "再输一次", "new-password"],
  ] as const
  return (
    <Card>
      <CardHeader>
        <CardTitle>密码</CardTitle>
        <CardDescription>改完后其他设备的登录会失效</CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <CardContent className="grid gap-4">
          {fields.map(([name, label, autoComplete]) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={`pw-${name}`}>{label}</Label>
                  <Input
                    id={`pw-${name}`}
                    type="password"
                    autoComplete={autoComplete}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors[0] && (
                    <p className="text-sm text-destructive">{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>
          ))}
        </CardContent>
        <CardFooter className="mt-4">
          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, submitting]) => (
              <Button type="submit" disabled={!canSubmit || submitting}>
                改密码
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  )
}

/** 绑定的第三方登录账号：绑定后可以用 GitHub 直接登录后台 */
function LinkedCard() {
  const qc = useQueryClient()
  const { data: site } = useQuery({ queryKey: ["site"], queryFn: () => unwrap(api.site.get()) })
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const r = await auth.listAccounts()
      if (errorOf(r)) throw new Error(errorOf(r))
      return r.data ?? []
    },
  })
  const unlink = useMutation({
    mutationFn: async (a: { providerId: string; accountId: string }) => {
      const r = await auth.unlinkAccount(a)
      if (errorOf(r)) throw new Error(errorOf(r))
    },
    onSuccess: () => {
      toast.success("已解除绑定")
      void qc.invalidateQueries({ queryKey: ["accounts"] })
    },
    onError: (e) => toast.error(e.message),
  })
  const link = async (provider: "github" | "google") => {
    const r = await auth.linkSocial({ provider, callbackURL: `${location.origin}/account` })
    if (errorOf(r)) toast.error(errorOf(r))
  }
  const labels: Record<string, string> = { github: "GitHub", google: "Google", credential: "邮箱密码" }
  const linked = new Set(accounts.data?.map((a) => a.providerId))
  const providers = (site?.oauth ?? []).filter((p) => !linked.has(p))
  const social = accounts.data?.filter((a) => a.providerId !== "credential") ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle>第三方登录</CardTitle>
        <CardDescription>绑定后，用对应账号登录会进入同一个站长账号</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border text-sm">
          {accounts.data?.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>{labels[a.providerId] ?? a.providerId}</span>
              {a.providerId !== "credential" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={unlink.isPending || accounts.data!.length < 2}
                  onClick={() => unlink.mutate({ providerId: a.providerId, accountId: a.accountId })}
                >
                  解除绑定
                </Button>
              )}
            </li>
          ))}
        </ul>
        {social.length === 0 && providers.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">服务端没有配置第三方登录。</p>
        )}
      </CardContent>
      {providers.length > 0 && (
        <CardFooter className="gap-2">
          {providers.map((p) => (
            <Button key={p} variant="outline" onClick={() => void link(p)}>
              绑定 {labels[p]}
            </Button>
          ))}
        </CardFooter>
      )}
    </Card>
  )
}

function PasskeyCard() {
  const passkeys = auth.useListPasskeys()
  const add = async () => {
    const r = await auth.passkey.addPasskey({ name: navigator.platform || "这台设备" })
    if (r?.error) toast.error(r.error.message ?? "没加上")
    else toast.success("Passkey 加好了，下次可以直接用它登录")
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkey</CardTitle>
        <CardDescription>
          用指纹、面容或安全密钥登录后台，不用记密码（绑定在 {location.hostname}）
        </CardDescription>
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
        <Button variant="outline" onClick={add}>
          <KeyRound /> 加一个 Passkey
        </Button>
      </CardFooter>
    </Card>
  )
}
