import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { toast } from "sonner"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { API_URL, auth } from "@/lib/api"

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: Login,
})

const schema = z.object({ email: z.email("邮箱格式不对"), password: z.string().min(8, "密码至少 8 位") })

function Login() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const done = () => navigate({ to: redirect ?? "/" })

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setError(null)
      const { error } = await auth.signIn.email(value)
      if (error) setError(error.message ?? "登录失败")
      else done()
    },
  })

  const passkey = async () => {
    const r = await auth.signIn.passkey()
    if (r?.error) toast.error(r.error.message ?? "Passkey 登录失败")
    else done()
  }

  const social = (provider: "github" | "google") =>
    auth.signIn.social({ provider, callbackURL: `${location.origin}${redirect ?? "/"}` })

  return (
    <main className="grid min-h-dvh place-items-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">登录 Driftlog 后台</h1>
        <p className="mt-1 text-sm text-muted-foreground">只有站长能进。</p>

        <div className="mt-6 grid gap-2">
          <Button variant="outline" onClick={passkey}>
            <KeyRound /> 用 Passkey 登录
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => social("github")}>
              GitHub
            </Button>
            <Button variant="outline" onClick={() => social("google")}>
              Google
            </Button>
          </div>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1" /> 或者用邮箱 <Separator className="flex-1" />
        </div>

        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          {(["email", "password"] as const).map((name) => (
            <form.Field key={name} name={name}>
              {(f) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={name}>{name === "email" ? "邮箱" : "密码"}</Label>
                  <Input
                    id={name}
                    type={name}
                    autoComplete={name === "email" ? "username webauthn" : "current-password webauthn"}
                    value={f.state.value}
                    onBlur={f.handleBlur}
                    onChange={(e) => f.handleChange(e.target.value)}
                    aria-invalid={!f.state.meta.isValid}
                  />
                  {f.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">{f.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(busy) => (
              <Button type="submit" disabled={busy}>
                {busy ? "登录中…" : "登录"}
              </Button>
            )}
          </form.Subscribe>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          API：<span className="font-mono">{API_URL}</span>
        </p>
      </div>
    </main>
  )
}
