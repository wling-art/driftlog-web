import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { revalidateLogic, useForm, useStore, type AnyFieldApi } from "@tanstack/react-form"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { commentInput, unwrap } from "@driftlog/client"
import { Window } from "@/components/boring"
import { Button } from "@/components/ui/button"
import { api, commentsQuery, type Comment } from "@/lib/api"

/*
 * 评论就是一份 comments.log：
 * - 每条评论是日志里的一段：行号 · 像素字母头像 · 名字 @ 时间；回复用 └─ 连到上一条
 * - 底下不是表单，是一行命令提示符：打字、回车就发。第一次发的时候像登录一样问「你叫什么」「邮箱」，之后记住你
 * - 回车发送，Shift + 回车换行；输入法选字时的回车不算
 * 没有 Gravatar：不往第三方发评论者的邮箱哈希，头像用名字的第一个字
 */

// 和 tokens.css 同一套曲线：出现 240ms、离开 160ms
const easeEnter = [0.37, 0.42, 0.12, 0.85] as const
const easeExit = [0.88, 0.15, 0.63, 0.58] as const
const REMEMBER = "driftlog-commenter"

type Node = Comment & { children: Node[]; line: number }
type Line = Node & { depth: number }
type Identity = { author: string; email: string }

function buildTree(list: Comment[]) {
  const map = new Map<number, Node>(list.map((c) => [c.id, { ...c, children: [], line: 0 }]))
  const roots: Node[] = []
  for (const n of map.values()) {
    const parent = n.parentId ? map.get(n.parentId) : undefined
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  // 行号按显示顺序（深度优先）编
  let line = 0
  const number = (ns: Node[]) => ns.forEach((n) => ((n.line = ++line), number(n.children)))
  number(roots)
  const lines: Line[] = []
  const flat = (ns: Node[], depth: number) =>
    ns.forEach((n) => (lines.push({ ...n, depth }), flat(n.children, depth + 1)))
  flat(roots, 0)
  return lines
}

const stamp = (d: string | Date) => {
  const t = new Date(d)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
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
  const lines = useMemo(() => buildTree(data ?? []), [data])
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const reply = (c: Comment) => {
    setReplyTo(c)
    promptRef.current?.focus()
  }

  return (
    <Window id="comments" name="comments.log" aria-label="评论" closable={false} className="comments">
      <p className="log-head">
        {isPending
          ? "# 在翻日志…"
          : isError
            ? "# ✕ 日志没读出来"
            : data?.length
              ? `# ${data.length} 条评论 · 最后一条 ${stamp(data.at(-1)!.createdAt)}`
              : "# 这份日志还是空的。敲下第一行吧"}
        {isError && (
          <button type="button" className="log-link" onClick={() => refetch()}>
            重试
          </button>
        )}
      </p>
      {lines.length > 0 && (
        <ol className="log">
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
      className="log-entry"
      style={{ "--depth": Math.min(n.depth, 3) } as React.CSSProperties}
      data-reply={n.depth > 0 || undefined}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: easeEnter }}
    >
      <span className="log-no" aria-hidden="true">
        {n.line}
      </span>
      <div className="log-row">
        <span className="log-avatar" aria-hidden="true">
          {initial(n.author)}
        </span>
        <div className="min-w-0">
          <p className="log-meta">
            {n.url ? (
              <a href={n.url} rel="nofollow noopener ugc" target="_blank" className="log-author is-link">
                {n.author}
              </a>
            ) : (
              <span className="log-author">{n.author}</span>
            )}
            <time dateTime={String(n.createdAt)}>@ {stamp(n.createdAt)}</time>
            <button
              type="button"
              className="log-link"
              onClick={() => onReply(n)}
              aria-label={`回复 ${n.author}`}
            >
              回复
            </button>
          </p>
          <div className="comment-body" dangerouslySetInnerHTML={{ __html: n.html }} />
        </div>
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

  const who = identity?.author ?? "访客"

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
            ↳ 回复 #{replyTo.author}
            <button type="button" className="log-link" onClick={onCancelReply}>
              不回了（Esc）
            </button>
          </motion.p>
        )}
      </AnimatePresence>

      <form.Field name="body" validators={{ onDynamic: shape.body }}>
        {(f) => (
          <div className="prompt-line">
            <label htmlFor="comment-body" className="prompt-ps1">
              {who}@driftlog:~$
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
              placeholder={replyTo ? `回 ${replyTo.author} 点什么` : "说点什么，回车发送"}
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
                      <label htmlFor={`comment-${name}`} className="prompt-ps1">
                        {name === "author" ? "? 你叫什么：" : "? 邮箱（不公开，有人回你时通知）："}
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
                <button type="button" className="log-link" onClick={() => saveIdentity(null)}>
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
