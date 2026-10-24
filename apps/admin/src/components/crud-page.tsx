import { useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import type { z } from "zod"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/routes/_app"

/** 通用管理页：左边表格，右边新建 / 编辑表单。nullable 字段的空字符串提交时换成 null */

export type Field = {
  name: string
  label: string
  kind?: "text" | "textarea" | "url" | "number" | "select"
  options?: { value: string; label: string }[]
  nullable?: boolean
  hint?: string
}
export type Column<R> = { header: string; cell: (row: R) => ReactNode; className?: string }

type Row = { id: number } & Record<string, unknown>

export function CrudPage<R extends Row>({
  title,
  description,
  queryKey,
  list,
  create,
  update,
  remove,
  schema,
  fields,
  columns,
  rowActions,
  empty,
  noun,
}: {
  title: string
  description?: string
  queryKey: string
  list: () => Promise<R[]>
  create: (v: Record<string, unknown>) => Promise<unknown>
  update?: (id: number, v: Record<string, unknown>) => Promise<unknown>
  remove: (id: number) => Promise<unknown>
  schema: z.ZodType
  fields: Field[]
  columns: Column<R>[]
  rowActions?: (row: R, refresh: () => void) => ReactNode
  empty: string
  /** 按钮和标题里的名词，如「一言」 */
  noun: string
}) {
  const qc = useQueryClient()
  const { data, isPending } = useQuery({ queryKey: [queryKey], queryFn: list })
  const refresh = () => qc.invalidateQueries({ queryKey: [queryKey] })
  const [editing, setEditing] = useState<R | null>(null)
  const del = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("已删除")
      refresh()
    },
    onError: (e) => toast.error(`删除失败：${e.message}`),
  })

  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                {columns.map((c) => (
                  <TableHead
                    key={c.header}
                    className={`text-xs font-medium text-muted-foreground ${c.className ?? ""}`}
                  >
                    {c.header}
                  </TableHead>
                ))}
                <TableHead className="w-0">
                  <span className="sr-only">操作</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.length ? (
                data.map((row) => (
                  <TableRow key={row.id} data-state={editing?.id === row.id ? "selected" : undefined}>
                    {columns.map((c) => (
                      <TableCell key={c.header} className={`whitespace-normal ${c.className ?? ""}`}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {rowActions?.(row, refresh)}
                        {update && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="编辑"
                            onClick={() => setEditing(row)}
                          >
                            <Pencil />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive"
                          aria-label="删除"
                          onClick={() => del.mutate(row.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-28 text-center text-sm text-muted-foreground"
                  >
                    {isPending ? "加载中…" : empty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <EditorCard
          key={editing?.id ?? "new"}
          noun={noun}
          editing={editing}
          fields={fields}
          schema={schema}
          onCancel={() => setEditing(null)}
          onSave={async (v) => {
            if (editing && update) await update(editing.id, v)
            else await create(v)
            setEditing(null)
            refresh()
          }}
        />
      </div>
    </>
  )
}

function EditorCard({
  noun,
  editing,
  fields,
  schema,
  onSave,
  onCancel,
}: {
  noun: string
  editing: Row | null
  fields: Field[]
  schema: z.ZodType
  onSave: (v: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const initial = Object.fromEntries(
    fields.map((f) => [
      f.name,
      editing?.[f.name] ?? (f.kind === "number" ? 0 : (f.options?.[0]?.value ?? "")),
    ]),
  ) as Record<string, string | number>
  const toValues = (v: Record<string, string | number>) =>
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.nullable && v[f.name] === "" ? null : f.kind === "number" ? Number(v[f.name]) : v[f.name],
      ]),
    )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      const values = toValues(value)
      const r = schema.safeParse(values)
      if (!r.success) {
        setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])))
        return
      }
      setErrors({})
      try {
        await onSave(values)
        formApi.reset()
        toast.success(editing ? "已保存" : "建好了")
      } catch (e) {
        toast.error(`没保存上：${(e as Error).message}`)
      }
    },
  })

  return (
    <Card className="xl:sticky xl:top-16">
      <CardHeader>
        <CardTitle>{editing ? `编辑${noun}` : `新${noun}`}</CardTitle>
        {editing && <CardDescription>改完点保存；不改就取消</CardDescription>}
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          {fields.map((fd) => (
            <form.Field key={fd.name} name={fd.name}>
              {(f) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`crud-${fd.name}`}>{fd.label}</Label>
                  {fd.kind === "textarea" ? (
                    <Textarea
                      id={`crud-${fd.name}`}
                      value={String(f.state.value ?? "")}
                      onChange={(e) => f.handleChange(e.target.value)}
                      aria-invalid={!!errors[fd.name]}
                      className="min-h-24"
                    />
                  ) : fd.kind === "select" ? (
                    <Select value={String(f.state.value)} onValueChange={f.handleChange}>
                      <SelectTrigger id={`crud-${fd.name}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fd.options!.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`crud-${fd.name}`}
                      type={fd.kind === "url" ? "url" : fd.kind === "number" ? "number" : "text"}
                      value={String(f.state.value ?? "")}
                      onChange={(e) => f.handleChange(e.target.value)}
                      aria-invalid={!!errors[fd.name]}
                      className={fd.kind === "url" ? "font-mono text-xs" : undefined}
                    />
                  )}
                  {errors[fd.name] ? (
                    <p className="text-xs text-destructive">{errors[fd.name]}</p>
                  ) : (
                    fd.hint && <p className="text-xs text-muted-foreground">{fd.hint}</p>
                  )}
                </div>
              )}
            </form.Field>
          ))}
          <div className="flex gap-2">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(busy) => (
                <Button type="submit" disabled={busy} className="flex-1">
                  {busy ? "保存中…" : editing ? "保存" : `建${noun}`}
                </Button>
              )}
            </form.Subscribe>
            {editing && (
              <Button type="button" variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
