import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react"
import { categoryInput } from "@driftlog/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, unwrap } from "@/lib/api"
import { PageHeader } from "../_app"

export const Route = createFileRoute("/_app/categories")({ component: Categories })

type Cat = Awaited<ReturnType<typeof fetchAll>>[number]
const fetchAll = () => unwrap(api.admin.categories.get())

function Categories() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ["admin-categories"], queryFn: fetchAll })
  // 拖完先按本地顺序显示（乐观更新），服务端确认后回到查询结果
  const [order, setOrder] = useState<number[] | null>(null)
  const items = order ? order.flatMap((id) => data?.find((c) => c.id === id) ?? []) : (data ?? [])

  const reorder = useMutation({
    mutationFn: (ids: number[]) => unwrap(api.admin.categories.order.put({ ids })),
    onError: (e) => toast.error(`排序没保存：${e.message}`),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-categories"] })
      setOrder(null)
    },
  })
  const move = (next: Cat[]) => {
    setOrder(next.map((c) => c.id))
    reorder.mutate(next.map((c) => c.id))
  }
  const remove = useMutation({
    mutationFn: (id: number) => unwrap(api.admin.categories({ id }).delete()),
    onSuccess: () => {
      toast.success("已删除分类，里面的文章变成「不分类」")
      qc.invalidateQueries({ queryKey: ["admin-categories"] })
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(
      arrayMove(
        items,
        items.findIndex((c) => c.id === active.id),
        items.findIndex((c) => c.id === over.id),
      ),
    )
  }

  return (
    <>
      <PageHeader title="分类" description="拖动排序，博客上的文件夹按这个顺序排" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border">
          {items.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">还没有分类。在右边建第一个。</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y">
                {items.map((c, i) => (
                  <SortableRow
                    key={c.id}
                    cat={c}
                    first={i === 0}
                    last={i === items.length - 1}
                    onUp={() => move(arrayMove(items, i, i - 1))}
                    onDown={() => move(arrayMove(items, i, i + 1))}
                    onDelete={() => remove.mutate(c.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
        <NewCategory />
      </div>
    </>
  )
}

function SortableRow({
  cat,
  first,
  last,
  onUp,
  onDown,
  onDelete,
}: {
  cat: Cat
  first: boolean
  last: boolean
  onUp: () => void
  onDown: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 bg-background px-3 py-2.5 ${isDragging ? "relative z-10 shadow-md" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent"
        aria-label={`拖动「${cat.name}」排序`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{cat.name}</div>
        <div className="truncate font-mono text-xs text-muted-foreground">
          /{cat.slug} · {cat.count} 篇
        </div>
      </div>
      {/* 拖拽只是快捷方式：上移 / 下移按钮一直在 */}
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={first}
        onClick={onUp}
        aria-label="上移"
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={last}
        onClick={onDown}
        aria-label="下移"
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive"
        onClick={onDelete}
        aria-label={`删除「${cat.name}」`}
      >
        <Trash2 />
      </Button>
    </li>
  )
}

function NewCategory() {
  const qc = useQueryClient()
  const form = useForm({
    defaultValues: { name: "", slug: "", description: "", sort: 0 },
    onSubmit: async ({ value, formApi }) => {
      try {
        await unwrap(api.admin.categories.post(value))
        formApi.reset()
        toast.success(`建好了「${value.name}」`)
        qc.invalidateQueries({ queryKey: ["admin-categories"] })
      } catch (e) {
        toast.error(`没建成：${(e as Error).message}`)
      }
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>新分类</CardTitle>
        <CardDescription>Slug 会出现在网址里：/posts?category=slug</CardDescription>
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
          {(["name", "slug", "description"] as const).map((name) => (
            <form.Field
              key={name}
              name={name}
              validators={
                name === "description"
                  ? undefined
                  : { onSubmit: categoryInput.shape[name], onBlur: categoryInput.shape[name] }
              }
            >
              {(f) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`cat-${name}`}>
                    {{ name: "名字", slug: "Slug", description: "说明（可不填）" }[name]}
                  </Label>
                  <Input
                    id={`cat-${name}`}
                    className={name === "slug" ? "font-mono" : undefined}
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    aria-invalid={!f.state.meta.isValid}
                  />
                  {f.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {(f.state.meta.errors[0] as { message?: string }).message}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          ))}
          <Button type="submit">建分类</Button>
        </form>
      </CardContent>
    </Card>
  )
}
