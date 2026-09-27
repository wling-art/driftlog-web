import { useMemo, useRef, useState, useSyncExternalStore } from "react"
import { revalidateLogic, useForm, useStore } from "@tanstack/react-form"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { commentInput, unwrap } from "@driftlog/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { auth } from "@/lib/auth"
import { api, commentsQuery, type Comment } from "@/lib/api"
import { fullTime, timeAgo } from "@/lib/site"

/*
 * 评论（comments.log，平时最小化在任务栏，见 comments-dock.tsx）
 * - 一个话题一张卡片（第 3 层：底色 + 细线 + 一点投影，和别的卡片同一个样子）
 *   卡片头一行：头像 · 名字 · 时间 ……… 回复；正文和名字左对齐
 * - 回复收在原话题的卡片里，淡线隔开、头像小一号；回复的不是楼主时写明「回复 某某」
 * - 写评论：标准的输入框 + 主按钮；名字和邮箱只在第一次开始写的时候才出现，之后记住
 * - ⌘ / Ctrl + 回车发送；Esc 取消回复
 * 没有 Gravatar：不往第三方发评论者的邮箱哈希，头像用名字的第一个字
 */

// 和 tokens.css 同一套曲线：出现 240ms、离开 160ms
const easeEnter = [0.37, 0.42, 0.12, 0.85] as const
const easeExit = [0.88, 0.15, 0.63, 0.58] as const
const reveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto", transition: { duration: 0.24, ease: easeEnter } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.16, ease: easeExit } },
}

type Identity = { author: string; email: string }
type Reply = Comment & { to: string | null }
type Thread = { root: Comment; replies: Reply[] }

/** 按话题分组：每个顶层评论一组，它下面所有层的回复按时间排进同一组 */
function toThreads(list: Comment[]): Thread[] {
  const byId = new Map(list.map((c) => [c.id, c]))
  const rootOf = (c: Comment): Comment => {
    let cur = c
    while (cur.parentId && byId.has(cur.parentId)) cur = byId.get(cur.parentId)!
    return cur
  }
  const threads = new Map<number, Thread>()
  for (const c of list) {
    const root = rootOf(c)
    const t = threads.get(root.id) ?? { root, replies: [] }
    threads.set(root.id, t)
    if (c.id !== root.id) {
      const parent = byId.get(c.parentId!)!
      // 直接回楼主不用写；回的是楼里别人才写「回复 某某」
      t.replies.push({ ...c, to: parent.id === root.id ? null : parent.author })
    }
  }
  return [...threads.values()]
}

const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? "?"

// 记住的身份：localStorage 当外部存储订阅，SSR 时是 null（不会水合不一致）
const REMEMBER = "driftlog-commenter"
const identityListeners = new Set<() => void>()
const readIdentityRaw = () => {
  try {
    return localStorage.getItem(REMEMBER)
  } catch {
    return null
  }
}
function saveIdentity(v: Identity | null) {
  try {
    if (v) localStorage.setItem(REMEMBER, JSON.stringify(v))
    else localStorage.removeItem(REMEMBER)
  } catch {}
  identityListeners.forEach((l) => l())
}
function useIdentity(): Identity | null {
  const raw = useSyncExternalStore(
    (cb) => (identityListeners.add(cb), () => void identityListeners.delete(cb)),
    readIdentityRaw,
    () => null,
  )
  return useMemo(() => {
    try {
      const v = JSON.parse(raw ?? "null") as Partial<Identity> | null
      return v?.author && v.email ? { author: v.author, email: v.email } : null
    } catch {
      return null
    }
  }, [raw])
}

/** 评论内容本身（列表 + 写评论）。外面的窗口由 CommentsDock 提供 */
export function Comments({ entryId }: { entryId: number }) {
  const { data, isPending, isError, refetch } = useQuery(commentsQuery(entryId))
  const threads = useMemo(() => toThreads(data ?? []), [data])
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  const reply = (c: Comment) => {
    setReplyTo(c)
    boxRef.current?.focus()
  }

  return (
    <>
      <p className="c-count pixel-1">
        {isPending
          ? "在翻评论…"
          : isError
            ? "✕ 评论没加载出来"
            : data?.length
              ? `${data.length} 条评论`
              : "还没有评论"}
        {isError && (
          <Button variant="link" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        )}
      </p>

      {threads.length > 0 && (
        <ol className="c-threads">
          {threads.map((t) => (
            <motion.li
              key={t.root.id}
              className="c-card"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: easeEnter }}
            >
              <CommentItem c={t.root} onReply={reply} />
              {t.replies.length > 0 && (
                <ol className="c-replies">
                  {t.replies.map((r) => (
                    <li key={r.id}>
                      <CommentItem c={r} to={r.to} onReply={reply} small />
                    </li>
                  ))}
                </ol>
              )}
            </motion.li>
          ))}
        </ol>
      )}

      <Composer
        entryId={entryId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        boxRef={boxRef}
        empty={data?.length === 0}
      />
    </>
  )
}

function CommentItem({
  c,
  to,
  small,
  onReply,
}: {
  c: Comment
  to?: string | null
  small?: boolean
  onReply: (c: Comment) => void
}) {
  return (
    <div id={`comment-${c.id}`} className={small ? "c-item is-small" : "c-item"}>
      <div className="c-head">
        <span className="c-avatar" aria-hidden="true">
          {initial(c.author)}
        </span>
        {c.url ? (
          <a href={c.url} rel="nofollow noopener ugc" target="_blank" className="c-name is-link">
            {c.author}
          </a>
        ) : (
          <span className="c-name">{c.author}</span>
        )}
        {to && <span className="c-meta">回复 {to}</span>}
        <time className="c-meta" dateTime={String(c.createdAt)} title={fullTime(c.createdAt)}>
          {timeAgo(c.createdAt)}
        </time>
        <button type="button" className="c-reply" onClick={() => onReply(c)} aria-label={`回复 ${c.author}`}>
          回复
        </button>
      </div>
      <div className="comment-body" dangerouslySetInnerHTML={{ __html: c.html }} />
    </div>
  )
}

function Composer({
  entryId,
  replyTo,
  onCancelReply,
  boxRef,
  empty,
}: {
  entryId: number
  replyTo: Comment | null
  onCancelReply: () => void
  boxRef: React.RefObject<HTMLTextAreaElement | null>
  empty: boolean
}) {
  const qc = useQueryClient()
  // 登录了就用账号的名字和邮箱（服务端也按会话认人）；没登录用上次记住的
  const account = auth.useSession().data?.user
  const remembered = useIdentity()
  const identity = account ? { author: account.name, email: account.email } : remembered
  // 名字、邮箱：没记住身份、而且开始写了才出现（渐进展开，不一上来就摆一张表）
  const [engaged, setEngaged] = useState(false)

  const form = useForm({
    defaultValues: { author: "", email: "", body: "", private: false },
    // 先不打扰；提交过一次之后边输边校验，改对就消失
    validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "change" }),
    onSubmit: async ({ value, formApi }) => {
      const who = identity ?? { author: value.author.trim(), email: value.email.trim() }
      try {
        const c = await unwrap(
          api.comments.post({
            entryId,
            parentId: replyTo?.id ?? null,
            author: who.author,
            email: who.email,
            url: null,
            body: value.body,
            private: value.private,
          }),
        )
        if (!account) saveIdentity(who)
        formApi.reset()
        setEngaged(false)
        onCancelReply()
        await qc.invalidateQueries({ queryKey: ["comments", entryId] })
        toast(
          value.private
            ? "悄悄话送到了，只有站长看得到 ✓"
            : c.status === "approved"
              ? "评论发出去了 ✓"
              : "收到了。审核完就会出现在这里",
        )
      } catch (e) {
        toast.error(`没发出去：${(e as Error).message}。内容还在输入框里`)
      }
    },
  })
  const busy = useStore(form.store, (s) => s.isSubmitting)
  const hasText = useStore(form.store, (s) => s.values.body.length > 0)
  const shape = commentInput.shape
  const askIdentity = !identity && (engaged || hasText)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && replyTo) return onCancelReply()
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void form.handleSubmit()
    }
  }

  return (
    <form
      noValidate
      className="c-composer"
      aria-label="写评论"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="c-composer-head">
        <Label htmlFor="comment-body" className="pixel-1">
          {replyTo ? `回复 ${replyTo.author}` : "写评论"}
        </Label>
        {replyTo && (
          <Button type="button" variant="link" size="sm" onClick={onCancelReply}>
            不回复了
          </Button>
        )}
      </div>

      <form.Field name="body" validators={{ onDynamic: shape.body }}>
        {(f) => (
          <div>
            <Textarea
              ref={boxRef}
              id="comment-body"
              rows={3}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onFocus={() => setEngaged(true)}
              onKeyDown={onKeyDown}
              aria-invalid={!f.state.meta.isValid}
              aria-describedby="comment-hint"
              placeholder={empty ? "第一个留言的人最显眼 ~" : "说点什么…"}
              className="min-h-20"
            />
            <FieldError errors={f.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <AnimatePresence initial={false}>
        {askIdentity && (
          <motion.div key="who" {...reveal} className="overflow-hidden">
            <div className="c-identity">
              {(["author", "email"] as const).map((name) => (
                <form.Field
                  key={name}
                  name={name}
                  validators={{
                    onDynamic: ({ value }) => shape[name].safeParse(value).error?.issues[0]?.message,
                  }}
                >
                  {(f) => (
                    <div>
                      <Label htmlFor={`comment-${name}`} className="pixel-1 mb-1">
                        {name === "author" ? "名字" : "邮箱（不公开）"}
                      </Label>
                      <Input
                        id={`comment-${name}`}
                        type={name === "email" ? "email" : "text"}
                        inputMode={name === "email" ? "email" : undefined}
                        autoComplete={name === "email" ? "email" : "name"}
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        aria-invalid={!f.state.meta.isValid}
                      />
                      <FieldError errors={f.state.meta.errors} />
                    </div>
                  )}
                </form.Field>
              ))}
            </div>
            <p className="c-hint mt-2">第一次评论留个名字，下次就不用填了。有人回复你时会发邮件。</p>
          </motion.div>
        )}
      </AnimatePresence>

      <form.Field name="private">
        {(f) => (
          <label className="c-private">
            <input
              type="checkbox"
              checked={f.state.value}
              onChange={(e) => f.handleChange(e.target.checked)}
            />
            悄悄话（只有站长看得到，不会公开）
          </label>
        )}
      </form.Field>

      <div className="c-composer-foot">
        <p id="comment-hint" className="c-hint">
          {identity ? (
            <>
              以 {identity.author} 的身份 ·{" "}
              <button
                type="button"
                className="c-reply"
                onClick={() => (account ? void auth.signOut() : saveIdentity(null))}
              >
                {account ? "退出登录" : "换一个"}
              </button>
            </>
          ) : (
            "支持 Markdown"
          )}
          <span className="only-fine"> · ⌘ + 回车发送</span>
        </p>
        <Button type="submit" variant="primary" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "在发了…" : "发表评论"}
        </Button>
      </div>
    </form>
  )
}

function FieldError({ errors }: { errors: unknown[] }) {
  const msg = errors
    .map((e) => (typeof e === "string" ? e : (e as { message?: string })?.message))
    .find(Boolean)
  return msg ? <p className="mt-1 text-(length:--text-sm) text-danger">✕ {msg}</p> : null
}
