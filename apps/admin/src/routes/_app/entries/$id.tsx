import { useEffect, useState } from "react"
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm, useStore } from "@tanstack/react-form"
import { z } from "zod"
import { toast } from "sonner"
import { ExternalLink, Languages } from "lucide-react"
import { entryInput, type EntryInput } from "@driftlog/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { MarkdownEditor } from "@/components/markdown-editor"
import { MarkdownPreview } from "@/components/markdown-preview"
import { api, blogPath, unwrap } from "@/lib/api"

export const Route = createFileRoute("/_app/entries/$id")({
  validateSearch: z.object({ type: z.enum(["post", "note", "page"]).optional() }),
  component: EditorPage,
})

const typeLabel = { post: "文章", note: "手记", page: "页面" } as const

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

function EditorPage() {
  const { id } = Route.useParams()
  const isNew = id === "new"
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin-entry", id],
    queryFn: () => unwrap(api.admin.entries({ id: Number(id) }).get()),
    enabled: !isNew,
  })
  if (!isNew && isPending) return <Skeleton className="h-[70vh] w-full" />
  if (!isNew && (isError || !data))
    return <p className="text-sm text-destructive">没找到这篇，可能已经删了。</p>
  return <Editor key={id} id={isNew ? null : Number(id)} initial={data ?? null} />
}

function Editor({
  id,
  initial,
}: {
  id: number | null
  initial: (EntryInput & { id: number; slug: string; type: EntryInput["type"] }) | null
}) {
  const { type: newType } = Route.useSearch()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [pane, setPane] = useState<"edit" | "preview">("edit")
  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => unwrap(api.admin.categories.get()),
  })
  const topics = useQuery({ queryKey: ["admin-topics"], queryFn: () => unwrap(api.admin.topics.get()) })

  const defaults: EntryInput = {
    type: initial?.type ?? newType ?? "post",
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    body: initial?.body ?? "",
    categoryId: initial?.categoryId ?? null,
    tags: initial?.tags ?? [],
    cover: initial?.cover ?? null,
    published: initial?.published ?? false,
    pinned: initial?.pinned ?? false,
    mood: initial?.mood ?? null,
    weather: initial?.weather ?? null,
    topicId: initial?.topicId ?? null,
    subtitle: initial?.subtitle ?? null,
    copyright: initial?.copyright ?? true,
  }

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value, formApi }) => {
      const body = {
        ...value,
        slug: value.slug || slugify(value.title) || `${value.type}-${Date.now().toString(36)}`,
      }
      try {
        const saved = id
          ? await unwrap(api.admin.entries({ id }).patch(body))
          : await unwrap(api.admin.entries.post(body))
        formApi.reset(body)
        qc.invalidateQueries({ queryKey: ["admin-entries"] })
        qc.invalidateQueries({ queryKey: ["stats"] })
        toast.success(value.published ? "已保存并发布" : "草稿已保存")
        if (!id)
          navigate({
            to: "/entries/$id",
            params: { id: String(saved.id) },
            replace: true,
            ignoreBlocker: true,
          })
      } catch (e) {
        toast.error(`没保存上：${(e as Error).message}。内容还在编辑器里`)
      }
    },
  })
  const save = () => void form.handleSubmit()
  const dirty = useStore(form.store, (s) => s.isDirty)
  const body = useStore(form.store, (s) => s.values.body)
  const type = useStore(form.store, (s) => s.values.type)
  const errors = useStore(form.store, (s) => s.errors)

  // 有没保存的内容时，离开前拦一下
  // 读调用时的表单状态，不用上次渲染的 dirty：保存完立刻跳转时它还没更新
  useBlocker({
    shouldBlockFn: () => form.state.isDirty && !confirm("有没保存的内容，确定离开？"),
    enableBeforeUnload: () => form.state.isDirty,
  })

  const upload = async (file: File) => {
    const f = await unwrap(api.admin.files.post({ file }))
    return f.url
  }

  const [lang, setLang] = useState("en")
  const translate = async () => {
    if (!id) return
    await unwrap(api.admin.entries({ id }).translate.post({ lang }))
    toast("翻译已排队，完成后博客上会出现语言切换")
  }

  useEffect(() => {
    if (errors.length) toast.error("有字段没填对，看右侧标红的地方")
  }, [errors])

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="-mx-4 -my-6 flex min-h-[calc(100dvh-3rem)] flex-col md:-mx-8"
    >
      {/* 顶栏：标题 + 保存 */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 md:px-8">
        <form.Field name="title" validators={{ onSubmit: entryInput.shape.title }}>
          {(f) => (
            <Input
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              placeholder={`${typeLabel[type]}标题`}
              aria-label="标题"
              aria-invalid={!f.state.meta.isValid}
              className="h-10 min-w-0 flex-1 border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0 md:text-xl dark:bg-transparent"
            />
          )}
        </form.Field>
        <span className="text-xs text-muted-foreground">
          {dirty ? "有改动未保存" : id ? "已保存" : "新的"}
        </span>
        {initial?.published && (
          <Button variant="ghost" size="sm" asChild>
            <a href={blogPath(initial.type, initial.slug)} target="_blank" rel="noreferrer">
              <ExternalLink /> 查看
            </a>
          </Button>
        )}
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <Button type="submit" disabled={busy}>
              {busy ? "保存中…" : "保存"} <kbd className="ml-1 text-xs opacity-60">⌘S</kbd>
            </Button>
          )}
        </form.Subscribe>
      </div>

      {/* 宽屏三栏：编辑 | 预览 | 属性；中屏编辑 / 预览切换 + 属性；窄屏全部叠起来 */}
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col border-b lg:border-r lg:border-b-0">
          <div className="border-b px-4 py-2 2xl:hidden">
            <Tabs value={pane} onValueChange={(v) => setPane(v as typeof pane)}>
              <TabsList>
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">预览</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className={pane === "edit" ? "flex-1 px-2" : "hidden 2xl:block 2xl:flex-1 2xl:px-2"}>
            <form.Field name="body">
              {(f) => (
                <MarkdownEditor
                  value={f.state.value}
                  onChange={f.handleChange}
                  onUpload={upload}
                  onSave={save}
                />
              )}
            </form.Field>
          </div>
          <div className={pane === "preview" ? "flex-1 overflow-auto p-6 2xl:hidden" : "hidden"}>
            <MarkdownPreview markdown={body} />
          </div>
        </div>
        <div className="hidden min-w-0 overflow-auto border-r p-6 2xl:block">
          <MarkdownPreview markdown={body} />
        </div>

        <aside className="grid content-start gap-5 p-4 md:p-6">
          <form.Field name="type">
            {(f) => (
              <Field label="类型">
                <Select value={f.state.value} onValueChange={(v) => f.handleChange(v as EntryInput["type"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabel).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>
          <form.Field
            name="slug"
            validators={{
              onBlur: ({ value }) =>
                value && !entryInput.shape.slug.safeParse(value).success
                  ? "只能用小写字母、数字和 -"
                  : undefined,
            }}
          >
            {(f) => (
              <Field
                label="Slug"
                hint="网址里的名字，留空按标题生成"
                error={f.state.meta.errors[0] as string | undefined}
              >
                <Input
                  className="font-mono"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  placeholder="hello-world"
                  aria-invalid={!f.state.meta.isValid}
                />
              </Field>
            )}
          </form.Field>
          {type === "note" && (
            <form.Field name="topicId">
              {(f) => (
                <Field label="专栏">
                  <Select
                    value={f.state.value ? String(f.state.value) : "none"}
                    onValueChange={(v) => f.handleChange(v === "none" ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不归专栏</SelectItem>
                      {topics.data?.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          )}
          {type === "page" && (
            <form.Field name="subtitle">
              {(f) => (
                <Field label="副标题" hint="显示在页面标题下面那一行">
                  <Input
                    value={f.state.value ?? ""}
                    onChange={(e) => f.handleChange(e.target.value || null)}
                  />
                </Field>
              )}
            </form.Field>
          )}
          {type === "post" && (
            <form.Field name="categoryId">
              {(f) => (
                <Field label="分类">
                  <Select
                    value={f.state.value ? String(f.state.value) : "none"}
                    onValueChange={(v) => f.handleChange(v === "none" ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不分类</SelectItem>
                      {categories.data?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          )}
          <form.Field name="tags">
            {(f) => (
              <Field label="标签" hint="用逗号分开">
                <Input
                  defaultValue={f.state.value.join(", ")}
                  onBlur={(e) =>
                    f.handleChange([
                      ...new Set(
                        e.target.value
                          .split(/[,，]/)
                          .map((t) => t.trim())
                          .filter(Boolean),
                      ),
                    ])
                  }
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="cover">
            {(f) => (
              <Field label="封面图" hint="图片地址，可以先粘贴进正文拿到">
                <Input
                  value={f.state.value ?? ""}
                  onChange={(e) => f.handleChange(e.target.value || null)}
                  placeholder="https://…"
                />
              </Field>
            )}
          </form.Field>
          {type === "note" && (
            <div className="grid grid-cols-2 gap-3">
              <form.Field name="mood">
                {(f) => (
                  <Field label="心情">
                    <Input
                      value={f.state.value ?? ""}
                      onChange={(e) => f.handleChange(e.target.value || null)}
                      placeholder="平静"
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="weather">
                {(f) => (
                  <Field label="天气">
                    <Input
                      value={f.state.value ?? ""}
                      onChange={(e) => f.handleChange(e.target.value || null)}
                      placeholder="晴"
                    />
                  </Field>
                )}
              </form.Field>
            </div>
          )}
          <div className="grid gap-3 rounded-md border p-3">
            <form.Field name="published">
              {(f) => (
                <label className="flex items-center justify-between text-sm">
                  发布 <Switch checked={f.state.value} onCheckedChange={f.handleChange} />
                </label>
              )}
            </form.Field>
            {type !== "page" && (
              <form.Field name="copyright">
                {(f) => (
                  <label className="flex items-center justify-between text-sm">
                    文末版权声明 <Switch checked={f.state.value} onCheckedChange={f.handleChange} />
                  </label>
                )}
              </form.Field>
            )}
            <form.Field name="pinned">
              {(f) => (
                <label className="flex items-center justify-between text-sm">
                  置顶 <Switch checked={f.state.value} onCheckedChange={f.handleChange} />
                </label>
              )}
            </form.Field>
          </div>
          {id && (
            <Field label="AI 翻译" hint="需要服务端配置 AI_MODEL">
              <div className="flex gap-2">
                <Select value={lang} onValueChange={setLang}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={translate}>
                  <Languages /> 翻译
                </Button>
              </div>
            </Field>
          )}
        </aside>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
