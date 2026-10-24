import { useEffect, useState } from "react"
import { Command } from "cmdk"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { unwrap } from "@driftlog/client"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { entryPath, typeLabel, type EntryType } from "@/lib/site"
import { useUI } from "@/lib/store"

/** ⌘K 搜索面板：Dialog + cmdk，结果来自服务端搜索 */
export function SearchPanel() {
  const open = useUI((s) => s.searchOpen)
  const setOpen = useUI((s) => s.setSearchOpen)
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(!useUI.getState().searchOpen)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setOpen])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 150)
    return () => clearTimeout(t)
  }, [q])

  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => unwrap(api.search.get({ query: { q: debounced, limit: 8 } })),
    enabled: open && debounced.length > 0,
    placeholderData: (prev) => prev,
  })

  const go = (type: string, slug: string) => {
    setOpen(false)
    setQ("")
    navigate({ to: entryPath(type as EntryType, slug) })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent name="search.exe" className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">搜索文章</DialogTitle>
        <Command shouldFilter={false} label="搜索文章" className="grid gap-(--space-3)">
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="搜标题、正文、标签"
            className="h-(--control-h) w-full rounded-md border border-input bg-surface px-(--control-pad) text-base shadow-[var(--shadow-inset)] outline-none focus-visible:outline-(--focus-outline)"
          />
          <Command.List className="max-h-[50vh] overflow-y-auto">
            {debounced && !isFetching && !isError && data?.length === 0 && (
              <Command.Empty className="muted py-(--space-3)">
                没搜到「{debounced}」。换个词试试
              </Command.Empty>
            )}
            {isError && <p className="py-(--space-3) text-danger">✕ 搜索暂时不可用，稍后再试</p>}
            {!debounced && (
              <p className="muted py-(--space-3) text-(length:--text-sm)">
                输入就开始搜。↑↓ 选择，回车打开，Esc 关闭
              </p>
            )}
            {data?.map((hit) => (
              <Command.Item
                key={hit.id}
                value={String(hit.id)}
                onSelect={() => go(hit.type, hit.slug)}
                className="grid cursor-pointer gap-1 rounded-[3px] px-(--space-2) py-(--space-2) data-[selected=true]:bg-foreground data-[selected=true]:text-background [&_mark]:bg-transparent [&_mark]:text-inherit [&_mark]:underline"
              >
                <span className="flex items-baseline gap-2">
                  <span className="pixel-1 opacity-70">{typeLabel[hit.type as EntryType] ?? hit.type}</span>
                  <span dangerouslySetInnerHTML={{ __html: hit.title }} />
                </span>
                {hit.snippet && (
                  <span
                    className="line-clamp-2 text-(length:--text-sm) opacity-80"
                    dangerouslySetInnerHTML={{ __html: hit.snippet }}
                  />
                )}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
