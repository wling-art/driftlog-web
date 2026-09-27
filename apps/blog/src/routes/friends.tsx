import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { revalidateLogic, useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { linkApplyInput, unwrap } from "@driftlog/client"
import { Window } from "@/components/boring"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Empty, SiteShell } from "@/components/site"
import { api, linksQuery, useSite } from "@/lib/api"
import { site, siteOf } from "@/lib/site"

export const Route = createFileRoute("/friends")({
  loader: ({ context }) => context.queryClient.ensureQueryData(linksQuery()),
  head: ({ matches }) => ({ meta: [{ title: `友链 · ${siteOf(matches).title}` }] }),
  component: Friends,
})

type L = { id: number; name: string; url: string; avatar: string | null; description: string }

function LinkCards({ items }: { items: L[] }) {
  return (
    <ul className="card-grid">
      {items.map((l) => (
        <li key={l.id}>
          <a href={l.url} target="_blank" rel="noopener" className="friend">
            <Avatar src={l.avatar} name={l.name} />
            <span className="friend-text">
              <strong>{l.name}</strong>
              {l.description && <span>{l.description}</span>}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/** 对方的头像可能不许别的网站引用（或者挂了）：加载失败就退回名字首字 */
function Avatar({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken)
    return (
      <span className="friend-avatar c-avatar" aria-hidden="true">
        {[...name][0]}
      </span>
    )
  return (
    <img
      src={src}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      className="friend-avatar"
      onError={() => setBroken(true)}
    />
  )
}

function Friends() {
  const { data } = useSuspenseQuery(linksQuery())
  const friends = data.filter((l) => l.type === "friend")
  const collections = data.filter((l) => l.type === "collection")
  return (
    <SiteShell aside={<Apply />}>
      <Window id="friends" name="friends/" title="友链" rule={`// ${friends.length} 位朋友`} closable={false}>
        {friends.length ? <LinkCards items={friends} /> : <Empty>还没有友链。右边可以申请第一个。</Empty>}
      </Window>
      {collections.length > 0 && (
        <Window id="collections" name="collections/" title="收藏" rule="// 常去逛的站" closable={false}>
          <LinkCards items={collections} />
        </Window>
      )}
    </SiteShell>
  )
}

/** 申请友链：填完进后台待审核 */
function Apply() {
  const info = useSite()
  const form = useForm({
    defaultValues: { name: "", url: "", avatar: "", description: "", email: "" },
    validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "change" }),
    validators: {
      onDynamic: ({ value }) => {
        const r = linkApplyInput.safeParse({ ...value, avatar: value.avatar || null })
        if (r.success) return undefined
        return { fields: Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])) }
      },
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await unwrap(api.links.apply.post({ ...value, avatar: value.avatar || null }))
        formApi.reset()
        toast("收到了。审核通过后会出现在左边 ✓")
      } catch (e) {
        toast.error(`没提交上：${(e as Error).message}`)
      }
    },
  })
  const fields = [
    { name: "name", label: "站名" },
    { name: "url", label: "网址", type: "url" },
    { name: "avatar", label: "头像地址（可不填）", type: "url" },
    { name: "description", label: "一句话介绍（可不填）" },
    { name: "email", label: "邮箱（不公开，审核结果发到这里）", type: "email" },
  ] as const
  return (
    <Window id="apply" name="apply.txt" title="申请友链" closable={false}>
      <p className="c-hint mb-(--space-4)">
        先把本站加到你那边：{info.title} · {site.url}
      </p>
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
                <Label htmlFor={`apply-${fd.name}`} className="pixel-1 mb-1">
                  {fd.label}
                </Label>
                <Input
                  id={`apply-${fd.name}`}
                  type={"type" in fd ? fd.type : "text"}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  aria-invalid={!f.state.meta.isValid}
                />
                {f.state.meta.errors[0] && (
                  <p className="mt-1 text-(length:--text-sm) text-danger">
                    ✕ {String(f.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        ))}
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "在交了…" : "提交申请"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </Window>
  )
}
