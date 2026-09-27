import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { revalidateLogic, useForm, useStore, type AnyFieldApi } from "@tanstack/react-form"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { commentInput, unwrap } from "@driftlog/client"
import { Window } from "@/components/boring"
import { Button } from "@/components/ui/button"
import { api, commentsQuery, type Comment } from "@/lib/api"
import { fullTime, timeAgo } from "@/lib/site"

/*
 * 评论（comments.log）：
 * - 一条评论 = 像素字母头像 + 名字 + 一眼能懂的时间（3 小时前 / 昨天 14:20，悬停看完整时间）+ 正文 + 「回复」
 * - 回复缩进一层，并写明「回复 某某」，不用猜是回谁
 * - 写评论只有一个输入框：打字、回车就发。第一次发时再一步步问名字和邮箱，之后记住你
 * - 回车发送，Shift + 回车换行；输入法选字时的回车不算
 * 没有 Gravatar：不往第三方发评论者的邮箱哈希，头像用名字的第一个字
 */

// 和 tokens.css 同一套曲线：出现 240ms、离开 160ms
const easeEnter = [0.37, 0.42, 0.12, 0.85] as const
const easeExit = [0.88, 0.15, 0.63, 0.58] as const
const REMEMBER = "driftlog-commenter"

type Node = Comment & { children: Node[] }
type Line = Comment & { depth: number; parentAuthor: string | null }
type Identity = { author: string; email: string }

/** 树 → 按显示顺序（深度优先）排好的一列，每条带上缩进层级和它回复的是谁 */
function buildLines(list: Comment[]) {
  const map = new Map<number, Node>(list.map((c) => [c.id, { ...c, children: [] }]))
  const roots: Node[] = []
  for (const n of map.values()) {
    const parent = n.parentId ? map.get(n.parentId) : undefined
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  const lines: Line[] = []
  const flat = (ns: Node[], depth: number, parentAuthor: string | null) =>
    ns.forEach(({ children, ...n }) => {
      lines.push({ ...n, depth, parentAuthor })
      flat(children, depth + 1, n.author)
    })
  flat(roots, 0, null)
  return lines
}

const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? "?"

// 记住的身份：localStorage 当外部存储订阅，SSR 时是 null（不会水合不一致）
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

export function Comments({ entryId }: { entryId: number }) {
  const { data, isPending, isError, refetch } = useQuery(commentsQuery(entryId))
  const lines = useMemo(() => buildLines(data ?? []), [data])
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const reply = (c: Comment) => {
    setReplyTo(c)
    promptRef.current?.focus()
  }

  return (
    <Window id="comments" name="comments.log" aria-label="评论" closable={false} className="comments">
      <p className="c-head">
        {isPending
          ? "在翻评论…"
          : isError
            ? "✕ 评论没加载出来"
            : data?.length
              ? `${data.length} 条评论`
              : "还没人说话"}
        {isError && (
          <button type="button" className="c-link" onClick={() => refetch()}>
            重试
          </button>
        )}
      </p>
      {lines.length > 0 && (
        <ol className="c-list">
          {lines.map((n) => (
            <LogEntry key={n.id} line={n} onReply={reply} />
          ))}
        </ol>
      )}
      <Prompt
        entryId={entryId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        inputRef={promptRef}
      />
    </Window>
  )
}

function LogEntry({ line: n, onReply }: { line: Line; onReply: (c: Comment) => void }) {
  return (
    <motion.li
      id={`comment-${n.id}`}
      className="c-entry"
      style={{ "--depth": Math.min(n.depth, 2) } as React.CSSProperties}
      data-reply={n.depth > 0 || undefined}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: easeEnter }}
    >
      <span className="c-avatar" aria-hidden="true">
        {initial(n.author)}
      </span>
      <div className="min-w-0">
        <p className="c-meta">
          {n.url ? (
            <a href={n.url} rel="nofollow noopener ugc" target="_blank" className="c-author is-link">
              {n.author}
            </a>
          ) : (
            <span className="c-author">{n.author}</span>
          )}
          {n.parentAuthor && <span className="c-muted">回复 {n.parentAuthor}</span>}
          <time className="c-muted" dateTime={String(n.createdAt)} title={fullTime(n.createdAt)}>
            {timeAgo(n.createdAt)}
          </time>
        </p>
        <div className="comment-body" dangerouslySetInnerHTML={{ __html: n.html }} />
        <button type="button" className="c-link" onClick={() => onReply(n)} aria-label={`回复 ${n.author}`}>
          回复
        </button>
      </div>
    </motion.li>
  )
}

type Step = "body" | "author" | "email"

/** 命令提示符：正文 →（第一次）名字 → 邮箱 → 发出去 */
function Prompt({
  entryId,
  replyTo,
  onCancelReply,
  inputRef,
}: {
  entryId: number
  replyTo: Comment | null
  onCancelReply: () => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const qc = useQueryClient()
  const identity = useIdentity()
  const [step, setStep] = useState<Step>("body")
  const stepRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    defaultValues: { author: "", email: "", body: "" },
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
          }),
        )
        saveIdentity(who)
        formApi.reset()
        setStep("body")
        onCancelReply()
        await qc.invalidateQueries({ queryKey: ["comments", entryId] })
        toast(c.status === "approved" ? "写进日志了 ✓" : "收到了。审核完就会出现在日志里")
      } catch (e) {
        toast.error(`没发出去：${(e as Error).message}。内容还在输入框里`)
      }
    },
  })
  const busy = useStore(form.store, (s) => s.isSubmitting)
  const shape = commentInput.shape

  /** 校验当前这一步，过了就进下一步或者直接发 */
  const advance = async () => {
    const errors = await form.validateField(step, "submit")
    if (errors.length) return
    const next: Step | "send" =
      step === "body" ? (identity ? "send" : "author") : step === "author" ? "email" : "send"
    if (next === "send") return void form.handleSubmit()
    setStep(next)
  }

  useEffect(() => {
    if (step === "body") inputRef.current?.focus()
    else stepRef.current?.focus()
  }, [step, inputRef])

  // 回车发送；Shift + 回车换行；输入法正在选字时的回车不算
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (step !== "body") setStep("body")
      else if (replyTo) onCancelReply()
      return
    }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    if (!busy) void advance()
  }

  return (
    <form
      noValidate
      className="prompt"
      aria-label="写评论"
      onSubmit={(e) => {
        e.preventDefault()
        void advance()
      }}
    >
      <AnimatePresence initial={false}>
        {replyTo && (
          <motion.p
            key="reply"
            className="prompt-note"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: { duration: 0.24, ease: easeEnter } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.16, ease: easeExit } }}
          >
            正在回复 {replyTo.author}
            <button type="button" className="c-link" onClick={onCancelReply}>
              不回了（Esc）
            </button>
          </motion.p>
        )}
      </AnimatePresence>

      <form.Field name="body" validators={{ onDynamic: shape.body }}>
        {(f) => (
          <div className="prompt-line">
            <label htmlFor="comment-body" className="prompt-label">
              写评论{identity && <span className="c-muted">（以 {identity.author} 的身份）</span>}
            </label>
            <textarea
              ref={inputRef}
              id="comment-body"
              rows={1}
              value={f.state.value}
              onChange={(e) => change(f, e.target.value)}
              onKeyDown={onEnter}
              readOnly={step !== "body"}
              aria-invalid={!f.state.meta.isValid}
              aria-describedby="comment-hint"
              placeholder={replyTo ? `回复 ${replyTo.author}…` : "说点什么…"}
              className="prompt-input"
            />
            <PromptError errors={f.state.meta.errors} />
          </div>
        )}
      </form.Field>

      {/* 第一次发：像登录一样一步步问，问过就记住 */}
      <AnimatePresence initial={false}>
        {!identity && step !== "body" && (
          <motion.div
            key="login"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: { duration: 0.24, ease: easeEnter } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.16, ease: easeExit } }}
            className="overflow-hidden"
          >
            <p className="prompt-note">
              第一次来？报个名，下次就不问了（第 {step === "author" ? 1 : 2} 步，共 2 步）
            </p>
            {(["author", "email"] as const).map((name) =>
              step === name || (name === "author" && step === "email") ? (
                <form.Field
                  key={name}
                  name={name}
                  validators={{
                    onDynamic: ({ value }) => shape[name].safeParse(value).error?.issues[0]?.message,
                  }}
                >
                  {(f) => (
                    <div className="prompt-line">
                      <label htmlFor={`comment-${name}`} className="prompt-label">
                        {name === "author" ? "你的名字" : "你的邮箱（不公开，有人回复你时通知你）"}
                      </label>
                      <input
                        ref={step === name ? stepRef : undefined}
                        id={`comment-${name}`}
                        type={name === "email" ? "email" : "text"}
                        inputMode={name === "email" ? "email" : undefined}
                        autoComplete={name === "email" ? "email" : "name"}
                        value={f.state.value}
                        onChange={(e) => change(f, e.target.value)}
                        onKeyDown={onEnter}
                        readOnly={step !== name}
                        aria-invalid={!f.state.meta.isValid}
                        className="prompt-input"
                      />
                      <PromptError errors={f.state.meta.errors} />
                    </div>
                  )}
                </form.Field>
              ) : null,
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="prompt-foot">
        <p id="comment-hint" className="prompt-hint">
          {busy ? (
            "在发了…"
          ) : (
            <>
              回车发送 · Shift + 回车换行 · 支持 Markdown
              {identity && (
                <button type="button" className="c-link" onClick={() => saveIdentity(null)}>
                  不是 {identity.author}？
                </button>
              )}
            </>
          )}
        </p>
        {/* 触屏键盘上回车常常就是换行：给一个看得见的按钮 */}
        <Button type="submit" variant="primary" size="sm" disabled={busy} aria-busy={busy || undefined}>
          {step === "body" ? "发送 ↵" : "下一步 ↵"}
        </Button>
      </div>
    </form>
  )
}

/** 已经在报错的字段边输边校验：改对的那一刻错误就消失（逐步校验不走整表提交，revalidateLogic 管不到这里） */
function change(f: AnyFieldApi, value: string) {
  f.handleChange(value)
  if (!f.state.meta.isValid) void f.validate("submit")
}

function PromptError({ errors }: { errors: unknown[] }) {
  const msg = errors
    .map((e) => (typeof e === "string" ? e : (e as { message?: string })?.message))
    .find(Boolean)
  return msg ? <p className="prompt-error">✕ {msg}</p> : null
}
