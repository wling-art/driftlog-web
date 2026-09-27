import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { z } from "zod"
import { TaskbarButton } from "@/components/boring"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth, authError } from "@/lib/auth"

/*
 * 任务栏上的「登录」：读者登录后评论不用再填名字和邮箱。
 * 点开是一个小窗口：没登录时两个页签（登录 / 注册），登录了显示是谁 + 退出。
 * 后台只有站长进得去，这里的账号都是读者。
 */
export function AccountTask() {
  const { data, isPending } = auth.useSession()
  const [open, setOpen] = useState(false)
  const user = data?.user
  if (isPending) return null
  return (
    <>
      <TaskbarButton onClick={() => setOpen(true)} aria-haspopup="dialog">
        {user ? user.name : "登录"}
      </TaskbarButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent name={user ? "account.cfg" : "login.exe"} className="sm:max-w-sm">
          {user ? (
            <SignedIn name={user.name} email={user.email} onDone={() => setOpen(false)} />
          ) : (
            <SignIn onDone={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function SignedIn({ name, email, onDone }: { name: string; email: string; onDone: () => void }) {
  return (
    <div className="grid gap-(--space-4)">
      <DialogTitle>{name}</DialogTitle>
      <DialogDescription>已登录（{email}）。评论会用这个名字，有人回复会发邮件到这个邮箱。</DialogDescription>
      <Button
        onClick={async () => {
          await auth.signOut()
          onDone()
          toast("已退出登录")
        }}
      >
        退出登录
      </Button>
    </div>
  )
}

const shapes = {
  in: z.object({
    name: z.string(),
    email: z.email("邮箱格式不对"),
    password: z.string().min(1, "写一下密码"),
  }),
  up: z.object({
    name: z.string().trim().min(1, "起个名字，评论时显示它").max(40, "名字太长了"),
    email: z.email("邮箱格式不对"),
    password: z.string().min(8, "密码至少 8 位"),
  }),
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in")
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: { onSubmit: shapes[mode] },
    onSubmit: async ({ value }) => {
      setError(null)
      const r =
        mode === "in"
          ? await auth.signIn.email({ email: value.email, password: value.password })
          : await auth.signUp.email({ name: value.name.trim(), email: value.email, password: value.password })
      if (r.error) return setError(authError(r.error))
      onDone()
      toast(mode === "in" ? `欢迎回来，${r.data.user.name}` : `注册好了，${r.data.user.name}`)
    },
  })
  const fields = [
    ...(mode === "up" ? [{ name: "name" as const, label: "名字", type: "text", auto: "nickname" }] : []),
    { name: "email" as const, label: "邮箱", type: "email", auto: "email" },
    {
      name: "password" as const,
      label: mode === "up" ? "密码（至少 8 位）" : "密码",
      type: "password",
      auto: mode === "up" ? "new-password" : "current-password",
    },
  ]

  return (
    <div className="grid gap-(--space-4)">
      <DialogTitle>账号</DialogTitle>
      <DialogDescription>登录后评论不用再填名字和邮箱。</DialogDescription>
      {/* 两个页签：像分段控件，当前的反白 */}
      <div className="lang-switch mb-0!" role="tablist" aria-label="登录还是注册">
        {(["in", "up"] as const).map((m) => (
          <Button
            key={m}
            size="sm"
            role="tab"
            aria-selected={mode === m}
            data-on={mode === m || undefined}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
          >
            {m === "in" ? "登录" : "注册"}
          </Button>
        ))}
      </div>
      <form
        noValidate
        className="grid gap-(--space-3)"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        {fields.map((fd) => (
          <form.Field key={fd.name} name={fd.name}>
            {(f) => (
              <div>
                <Label htmlFor={`acct-${fd.name}`} className="pixel-1 mb-1">
                  {fd.label}
                </Label>
                <Input
                  id={`acct-${fd.name}`}
                  type={fd.type}
                  autoComplete={fd.auto}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  aria-invalid={!f.state.meta.isValid}
                />
                {f.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-(length:--text-sm) text-danger">
                    ✕{" "}
                    {String(
                      (f.state.meta.errors[0] as { message?: string })?.message ?? f.state.meta.errors[0],
                    )}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        ))}
        {error && (
          <p role="alert" className="text-(length:--text-sm) text-danger">
            ✕ {error}
          </p>
        )}
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "稍等…" : mode === "in" ? "登录" : "注册并登录"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}
