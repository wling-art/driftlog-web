import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { aiSettingsInput } from "@driftlog/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { api, unwrap } from "@/lib/api"

type Saved = Awaited<ReturnType<typeof load>>
const load = () => unwrap(api.admin.ai.get())

type Provider = {
  id: string
  name: string
  endpoint: string
  apiKey: string
  defaultModel: string
  enabled: boolean
  hasKey: boolean
}
type Task = { enabled: boolean; providerId: string; model: string }
type Values = { providers: Provider[]; translation: Task; summary: Task; moderation: Task; languages: string }

const tasks = [
  {
    key: "translation",
    label: "翻译",
    hint: "开启后，文章发布时自动翻译成目标语言；也可以在「翻译」页手动排队",
  },
  { key: "summary", label: "摘要", hint: "开启后，保存文章时由 AI 写一段摘要" },
  { key: "moderation", label: "评论审核", hint: "开启后，新评论先交给 AI 判断是不是垃圾评论" },
] as const

/** AI 设置：供应商（OpenAI 兼容接口）+ 翻译 / 摘要 / 评论审核三项任务 */
export function AiCard() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ["ai"], queryFn: load })
  if (!data)
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI</CardTitle>
          <CardDescription>加载中…</CardDescription>
        </CardHeader>
      </Card>
    )
  return (
    <AiForm
      key={JSON.stringify(data)}
      initial={data}
      onSaved={() => {
        qc.invalidateQueries({ queryKey: ["ai"] })
        qc.invalidateQueries({ queryKey: ["translations"] })
      }}
    />
  )
}

function AiForm({ initial, onSaved }: { initial: Saved; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const savedIds = new Set(initial.providers.map((p) => p.id))
  const form = useForm({
    defaultValues: {
      providers: initial.providers.map((p) => ({ ...p, apiKey: "" })),
      translation: {
        enabled: initial.translation.enabled,
        providerId: initial.translation.providerId,
        model: initial.translation.model,
      },
      summary: initial.summary,
      moderation: initial.moderation,
      languages: initial.translation.languages.join(", "),
    } as Values,
    onSubmit: async ({ value }) => {
      const r = aiSettingsInput.safeParse({
        providers: // hasKey 只是界面状态，schema 解析时会丢掉
          value.providers.map((p) => ({ ...p, endpoint: p.endpoint.trim() })),
        translation: {
          ...value.translation,
          languages: value.languages
            .split(/[,，\s]+/)
            .map((l) => l.trim())
            .filter(Boolean),
        },
        summary: value.summary,
        moderation: value.moderation,
      })
      if (!r.success) return setError(r.error.issues.map((i) => i.message).join("；"))
      setError(null)
      try {
        await unwrap(api.admin.ai.put(r.data))
        toast.success("AI 设置已保存")
        onSaved()
      } catch (e) {
        toast.error(`没保存上：${(e as Error).message}`)
      }
    },
  })

  // 测试已保存的供应商；没保存的得先保存
  const test = async (providerId: string, model: string) => {
    setTesting(providerId)
    try {
      const r = await unwrap(api.admin.ai.test.post({ providerId, model }))
      if (r.ok) toast.success(`连接正常：${r.reply}`)
      else toast.error(`连接失败：${r.reply}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI</CardTitle>
        <CardDescription>
          接入任意 OpenAI 兼容的接口（如 DeepSeek、OpenAI、本地 Ollama），用来翻译、写摘要、审核评论
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <section className="grid gap-3">
            <h3 className="text-sm font-medium">供应商</h3>
            <form.Field name="providers" mode="array">
              {(arr) => (
                <>
                  {arr.state.value.map((p, i) => (
                    <div key={p.id} className="grid gap-3 rounded-md border p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <form.Field name={`providers[${i}].name`}>
                          {(f) => (
                            <div className="grid gap-1.5">
                              <Label htmlFor={`ai-name-${p.id}`}>名称</Label>
                              <Input
                                id={`ai-name-${p.id}`}
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                              />
                            </div>
                          )}
                        </form.Field>
                        <form.Field name={`providers[${i}].defaultModel`}>
                          {(f) => (
                            <div className="grid gap-1.5">
                              <Label htmlFor={`ai-model-${p.id}`}>默认模型</Label>
                              <Input
                                id={`ai-model-${p.id}`}
                                placeholder="deepseek-chat"
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                              />
                            </div>
                          )}
                        </form.Field>
                      </div>
                      <form.Field name={`providers[${i}].endpoint`}>
                        {(f) => (
                          <div className="grid gap-1.5">
                            <Label htmlFor={`ai-endpoint-${p.id}`}>接口地址</Label>
                            <Input
                              id={`ai-endpoint-${p.id}`}
                              placeholder="https://api.deepseek.com"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                            />
                          </div>
                        )}
                      </form.Field>
                      <form.Field name={`providers[${i}].apiKey`}>
                        {(f) => (
                          <div className="grid gap-1.5">
                            <Label htmlFor={`ai-key-${p.id}`}>API Key</Label>
                            <Input
                              id={`ai-key-${p.id}`}
                              type="password"
                              autoComplete="off"
                              placeholder={p.hasKey ? "已保存，留空则不改" : "sk-…"}
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                            />
                          </div>
                        )}
                      </form.Field>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <form.Field name={`providers[${i}].enabled`}>
                          {(f) => (
                            <label className="flex items-center gap-2 text-sm">
                              <Switch checked={f.state.value} onCheckedChange={f.handleChange} /> 启用
                            </label>
                          )}
                        </form.Field>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!savedIds.has(p.id) || testing === p.id}
                            title={savedIds.has(p.id) ? undefined : "先保存，再测试连接"}
                            onClick={() => test(p.id, p.defaultModel)}
                          >
                            {testing === p.id ? "测试中…" : savedIds.has(p.id) ? "测试连接" : "保存后可测试"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => arr.removeValue(i)}
                            aria-label={`删除供应商 ${p.name}`}
                          >
                            <Trash2 /> 删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    onClick={() =>
                      arr.pushValue({
                        id: crypto.randomUUID(),
                        name: "",
                        endpoint: "",
                        apiKey: "",
                        defaultModel: "",
                        enabled: true,
                        hasKey: false,
                      })
                    }
                  >
                    <Plus /> 添加供应商
                  </Button>
                </>
              )}
            </form.Field>
          </section>

          {tasks.map((t) => (
            <section key={t.key} className="grid gap-3 border-t pt-4">
              <form.Field name={`${t.key}.enabled`}>
                {(f) => (
                  <label className="flex items-center justify-between text-sm font-medium">
                    {t.label} <Switch checked={f.state.value} onCheckedChange={f.handleChange} />
                  </label>
                )}
              </form.Field>
              <p className="text-xs text-muted-foreground">{t.hint}</p>
              <form.Subscribe selector={(s) => s.values}>
                {(values) => {
                  const providers = values.providers
                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <form.Field name={`${t.key}.providerId`}>
                        {(f) => (
                          <div className="grid gap-1.5">
                            <Label>供应商</Label>
                            <Select value={f.state.value} onValueChange={f.handleChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="选一个供应商" />
                              </SelectTrigger>
                              <SelectContent>
                                {providers.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name || "未命名"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                      <form.Field name={`${t.key}.model`}>
                        {(f) => (
                          <div className="grid gap-1.5">
                            <Label htmlFor={`ai-${t.key}-model`}>模型</Label>
                            <Input
                              id={`ai-${t.key}-model`}
                              placeholder={
                                providers.find((p) => p.id === values[t.key].providerId)?.defaultModel ||
                                "留空用供应商的默认模型"
                              }
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                            />
                          </div>
                        )}
                      </form.Field>
                    </div>
                  )
                }}
              </form.Subscribe>
              {t.key === "translation" && (
                <form.Field name="languages">
                  {(f) => (
                    <div className="grid gap-1.5">
                      <Label htmlFor="ai-languages">目标语言</Label>
                      <Input
                        id="ai-languages"
                        placeholder="en, ja"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">语言代码，用逗号分开，如 en, ja, ko, fr</p>
                    </div>
                  )}
                </form.Field>
              )}
            </section>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(busy) => (
              <Button type="submit" disabled={busy}>
                {busy ? "保存中…" : "保存 AI 设置"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}
