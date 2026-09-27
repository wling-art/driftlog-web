import { useEffect, useMemo, useRef, useState } from "react"
import { revalidateLogic, useForm, type AnyFieldApi } from "@tanstack/react-form"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { commentInput, unwrap } from "@driftlog/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Window } from "@/components/boring"
import { api, commentsQuery, type Comment } from "@/lib/api"
import { formatDate } from "@/lib/site"

// 和 tokens.css 同一套曲线和时长：出现 240ms、离开 160ms（离开比出现短）
const easeEnter = [0.37, 0.42, 0.12, 0.85] as const
const easeExit = [0.88, 0.15, 0.63, 0.58] as const
const REMEMBER = "driftlog-commenter"

type Node = Comment & { children: Node[] }

function buildTree(list: Comment[]) {
  const map = new Map<number, Node>(list.map((c) => [c.id, { ...c, children: [] }]))
  const roots: Node[] = []
  for (const n of map.values()) {
    const parent = n.parentId ? map.get(n.parentId) : undefined
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  return roots
}

/**
 * 评论是文章的附属：一个安静的小窗口，不抢正文。
 * - 没有 36px 大标题，只有一行「N 条评论」和「写评论」
 * - 列表紧凑：小头像、小字号
 * - 表单默认收起，点「写评论」或某条下面的「回复」才展开，发完再收起
 */
export function Comments({ entryId }: { entryId: number }) {
  const { data, isPending, isError, refetch } = useQuery(commentsQuery(entryId))
  const tree = useMemo(() => buildTree(data ?? []), [data])
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [writing, setWriting] = useState(false)
  const open = (to: Comment | null) => {
    setReplyTo(to)
    setWriting(true)
  }
  const close = () => {
    setReplyTo(null)
    setWriting(false)
  }

  return (
    <Window id="comments" name="comments.log" aria-label="评论" closable={false} className="comments">
      <div className="flex flex-wrap items-center justify-between gap-(--space-3)">
        <p className="pixel-1 muted">
          {isPending ? "在翻评论…" : data?.length ? `${data.length} 条评论` : "还没人说话"}
        </p>
        {!writing && (
          <Button size="sm" onClick={() => open(null)}>
            写评论
          </Button>
        )}
      </div>
      {isError && (
        <p className="mt-(--space-2) text-(length:--text-sm) text-danger">
          ✕ 评论没加载出来。
          <Button variant="link" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        </p>
      )}
      {tree.length > 0 && (
        <ol className="mt-(--space-4) grid gap-(--space-4)">
          {tree.map((n) => (
            <CommentNode key={n.id} node={n} onReply={open} />
          ))}
        </ol>
      )}
      {/* 表单展开 / 收起：高度和透明度一起走，外层 overflow 裁掉，里面不会被挤变形 */}
      <AnimatePresence initial={false}>
        {writing && (
          <motion.div
            key="form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: 0.24, ease: easeEnter } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.16, ease: easeExit } }}
            className="overflow-hidden"
          >
            <div className="mt-(--space-5) border-t border-border-soft pt-(--space-4)">
              <CommentForm entryId={entryId} replyTo={replyTo} onClose={close} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Window>
  )
}

function CommentNode({ node, onReply }: { node: Node; onReply: (c: Comment) => void }) {
  return (
    <motion.li
      id={`comment-${node.id}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: easeEnter }}
      className="grid grid-cols-[28px_minmax(0,1fr)] gap-(--space-3) text-(length:--text-sm)"
    >
      <img
        src={node.avatar}
        alt=""
        width={28}
        height={28}
        loading="lazy"
        className="mt-0.5 rounded-[3px] border border-border"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-(--space-2)">
          {node.url ? (
            <a
              href={node.url}
              rel="nofollow noopener ugc"
              target="_blank"
              className="font-semibold text-primary underline underline-offset-3"
            >
              {node.author}
            </a>
          ) : (
            <span className="font-semibold">{node.author}</span>
          )}
          <time className="pixel-1 muted" dateTime={String(node.createdAt)}>
            {formatDate(node.createdAt)}
          </time>
          <button
            type="button"
            className="pixel-1 text-primary underline underline-offset-2 hover:bg-foreground hover:text-background"
            onClick={() => onReply(node)}
          >
            回复
          </button>
        </div>
        <div className="comment-body" dangerouslySetInnerHTML={{ __html: node.html }} />
        {node.children.length > 0 && (
          <ol className="mt-(--space-3) grid gap-(--space-3) border-l border-border-soft pl-(--space-3)">
            {node.children.map((c) => (
              <CommentNode key={c.id} node={c} onReply={onReply} />
            ))}
          </ol>
        )}
      </div>
    </motion.li>
  )
}

function remembered() {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) ?? "{}") as {
      author?: string
      email?: string
      url?: string
    }
  } catch {
    return {}
  }
}

/**
 * 字段已经在报错时，每次输入都重新校验：改对的那一刻错误就消失。
 * 不这样的话，错误要等失焦才消失——点「发表评论」时先失焦，错误那行一消失按钮就往上跳，这一下点空了。
 */
function change(f: AnyFieldApi, value: string) {
  f.handleChange(value)
  if (!f.state.meta.isValid) void f.validate("blur")
}

function FieldError({ errors }: { errors: unknown[] }) {
  const msg = errors
    .map((e) => (typeof e === "string" ? e : (e as { message?: string })?.message))
    .find(Boolean)
  return msg ? <p className="mt-1 text-(length:--text-sm) text-danger">✕ {msg}</p> : null
}

function CommentForm({
  entryId,
  replyTo,
  onClose,
}: {
  entryId: number
  replyTo: Comment | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const saved = typeof window === "undefined" ? {} : remembered()
  const form = useForm({
    defaultValues: { author: saved.author ?? "", email: saved.email ?? "", url: saved.url ?? "", body: "" },
    // 失焦时校验；提交过一次之后每次输入都重新校验
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value, formApi }) => {
      try {
        const c = await unwrap(
          api.comments.post({
            entryId,
            parentId: replyTo?.id ?? null,
            author: value.author,
            email: value.email,
            url: value.url || null,
            body: value.body,
          }),
        )
        try {
          localStorage.setItem(
            REMEMBER,
            JSON.stringify({ author: value.author, email: value.email, url: value.url }),
          )
        } catch {}
        formApi.reset({ ...value, body: "" })
        onClose()
        await qc.invalidateQueries({ queryKey: ["comments", entryId] })
        toast(c.status === "approved" ? "评论发出去了 ✓" : "收到了。审核完就会出现在这里")
      } catch (e) {
        toast.error(`没发出去：${(e as Error).message}。内容还在输入框里`)
      }
    },
  })
  const shape = commentInput.shape

  // 展开时把光标放到第一个要填的地方：记住了名字和邮箱就直接进正文
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const el = ref.current
    el?.querySelector<HTMLElement>(saved.author && saved.email ? "textarea" : "input")?.focus()
    // 只在展开 / 换了回复对象时
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo])

  return (
    <form
      ref={ref}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="grid gap-(--space-4)"
      aria-label="写评论"
    >
      {replyTo && (
        <p className="text-(length:--text-sm)">
          回复 <strong>{replyTo.author}</strong>
        </p>
      )}
      <div className="grid gap-(--space-4) @lg:grid-cols-3">
        <form.Field name="author" validators={{ onDynamic: shape.author }}>
          {(f) => (
            <div>
              <Label htmlFor={`comment-${f.name}`} className="pixel-1 mb-1">
                名字
              </Label>
              <Input
                id={`comment-${f.name}`}
                autoComplete="name"
                value={f.state.value}
                onBlur={f.handleBlur}
                onChange={(e) => change(f, e.target.value)}
                aria-invalid={!f.state.meta.isValid}
              />
              <FieldError errors={f.state.meta.errors} />
            </div>
          )}
        </form.Field>
        <form.Field name="email" validators={{ onDynamic: shape.email }}>
          {(f) => (
            <div>
              <Label htmlFor={`comment-${f.name}`} className="pixel-1 mb-1">
                邮箱（不公开）
              </Label>
              <Input
                id={`comment-${f.name}`}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={f.state.value}
                onBlur={f.handleBlur}
                onChange={(e) => change(f, e.target.value)}
                aria-invalid={!f.state.meta.isValid}
              />
              <FieldError errors={f.state.meta.errors} />
            </div>
          )}
        </form.Field>
        <form.Field
          name="url"
          validators={{
            onBlur: ({ value }) =>
              value && !/^https?:\/\/\S+\.\S+/.test(value) ? "网址要以 http:// 或 https:// 开头" : undefined,
          }}
        >
          {(f) => (
            <div>
              <Label htmlFor={`comment-${f.name}`} className="pixel-1 mb-1">
                网站（可不填）
              </Label>
              <Input
                id={`comment-${f.name}`}
                type="url"
                inputMode="url"
                autoComplete="url"
                value={f.state.value}
                onBlur={f.handleBlur}
                onChange={(e) => change(f, e.target.value)}
                aria-invalid={!f.state.meta.isValid}
              />
              <FieldError errors={f.state.meta.errors} />
            </div>
          )}
        </form.Field>
      </div>
      <form.Field name="body" validators={{ onDynamic: shape.body }}>
        {(f) => (
          <div>
            <Label htmlFor={`comment-${f.name}`} className="pixel-1 mb-1">
              评论
            </Label>
            <Textarea
              id={`comment-${f.name}`}
              rows={3}
              value={f.state.value}
              onBlur={f.handleBlur}
              onChange={(e) => change(f, e.target.value)}
              aria-invalid={!f.state.meta.isValid}
              aria-describedby="comment-hint"
            />
            <p id="comment-hint" className="muted mt-1 text-(length:--text-sm)">
              支持 Markdown、||剧透||、==标记==。
            </p>
            <FieldError errors={f.state.meta.errors} />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(submitting) => (
          <div className="flex items-center gap-(--space-3)">
            <Button type="submit" variant="primary" aria-busy={submitting || undefined} disabled={submitting}>
              {submitting ? "在发了…" : "发表评论"}
            </Button>
            <Button type="button" variant="link" onClick={onClose}>
              收起
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}
