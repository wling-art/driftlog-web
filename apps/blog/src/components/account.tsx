import { useState } from "react"
import { toast } from "sonner"
import { useUI } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { auth } from "@/lib/auth"
import { useSite } from "@/lib/api"
import { BrandIcon } from "@/components/brand-icons"

/** 读者账号弹窗：未登录显示第三方登录，已登录显示账号和退出 */
export function AccountDialog() {
  const { data } = auth.useSession()
  const open = useUI((s) => s.accountOpen)
  const setOpen = useUI((s) => s.setAccountOpen)
  const user = data?.user
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent name={user ? "account.cfg" : "login.exe"} className="sm:max-w-sm">
        {user ? <SignedIn name={user.name} email={user.email} onDone={() => setOpen(false)} /> : <SignIn />}
      </DialogContent>
    </Dialog>
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

/** 第三方登录按钮，按服务端已配置的 provider 显示 */
function SignIn() {
  const { oauth } = useSite()
  const [busy, setBusy] = useState<string | null>(null)
  const go = async (provider: "github" | "google") => {
    setBusy(provider)
    // 登录后回到当前页
    const r = await auth.signIn.social({ provider, callbackURL: location.href })
    if (r.error) {
      setBusy(null)
      toast(`没登上：${r.error.message ?? "再试一次"}`)
    }
  }
  return (
    <div className="grid gap-(--space-4)">
      <DialogTitle>登录</DialogTitle>
      <DialogDescription>
        用 GitHub 或 Google 账号登录，第一次登录就是注册。登录后评论不用再填名字和邮箱，头像也用那边的。
      </DialogDescription>
      {oauth.length ? (
        <div className="grid gap-(--space-2)">
          {oauth.map((p) => (
            <Button key={p} onClick={() => go(p)} disabled={!!busy} aria-busy={busy === p || undefined}>
              <BrandIcon name={p} />
              {busy === p ? "正在跳转…" : `用 ${p === "github" ? "GitHub" : "Google"} 登录`}
            </Button>
          ))}
        </div>
      ) : (
        <p className="muted text-(length:--text-sm)">站长还没开第三方登录，评论时填个名字和邮箱也一样。</p>
      )}
    </div>
  )
}
