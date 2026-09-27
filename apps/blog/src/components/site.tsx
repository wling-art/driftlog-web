import type { ReactNode } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { Desktop, DesktopArea, Folders, Taskbar, TaskbarButton, Window, Windows } from "@/components/boring"
import { Button } from "@/components/ui/button"
import { useUI } from "@/lib/store"
import { entryPath, formatDate, site } from "@/lib/site"
import type { EntryCard } from "@/lib/api"

const nav = [
  { href: "/", label: site.name, exact: true },
  { href: "/posts", label: "文章" },
  { href: "/notes", label: "手记" },
  { href: "/about", label: "关于" },
]

/**
 * 每一页的外壳：全屏桌面 + 左边一列文件夹（本页目录）+ 窗口 + 吸底任务栏。
 * children 是主内容；aside 是附属窗口，宽屏时排到右边一栏，窄屏时排在主内容后面。
 */
export function SiteShell({
  folders,
  scene,
  aside,
  children,
}: {
  folders?: ReactNode
  scene?: "read" | "show"
  aside?: ReactNode
  children: ReactNode
}) {
  const online = useUI((s) => s.online)
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  return (
    <Desktop scene={scene}>
      <DesktopArea>
        <Folders>{folders}</Folders>
        <Windows className={aside ? "has-aside" : undefined}>
          <main className="wins-main">{children}</main>
          {aside && (
            <aside className="wins-aside" aria-label="相关">
              {aside}
            </aside>
          )}
        </Windows>
      </DesktopArea>
      <Taskbar items={nav}>
        {online > 0 && (
          <span className="clock" title="现在在看这个站的人">
            {online} 人在看
          </span>
        )}
        <TaskbarButton onClick={() => setSearchOpen(true)} aria-keyshortcuts="Meta+K Control+K">
          搜索 <kbd className="font-mono">⌘K</kbd>
        </TaskbarButton>
      </Taskbar>
    </Desktop>
  )
}

/** 文章 / 手记列表：整行能点，指上去反白 */
export function EntryList({ items }: { items: EntryCard[] }) {
  return (
    <ul className="entry-list">
      {items.map((e) => (
        <li key={e.id}>
          <Link to={entryPath(e.type, e.slug)} className="entry-row">
            <span className="t">
              {e.pinned && <span className="pixel-1 mr-2">[置顶]</span>}
              {e.title}
            </span>
            <time dateTime={String(e.publishedAt ?? e.createdAt)}>
              {formatDate(e.publishedAt ?? e.createdAt)}
            </time>
            {(e.summary || e.excerpt) && (
              <span className="muted col-span-2 line-clamp-2 text-(length:--text-sm)">
                {e.summary ?? e.excerpt}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Pager({ page, total, size, to }: { page: number; total: number; size: number; to: string }) {
  const pages = Math.ceil(total / size)
  if (pages <= 1) return null
  return (
    <nav aria-label="翻页" className="mt-(--space-5) flex items-center gap-(--space-3)">
      {page > 1 ? (
        <Button asChild>
          <Link to={to} search={{ page: page - 1 }}>
            上一页
          </Link>
        </Button>
      ) : null}
      <span className="pixel-1 muted">
        第 {page} 页，共 {pages} 页
      </span>
      {page < pages ? (
        <Button asChild>
          <Link to={to} search={{ page: page + 1 }}>
            下一页
          </Link>
        </Button>
      ) : null}
    </nav>
  )
}

export function NotFound() {
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  return (
    <SiteShell>
      <Window
        id="lost"
        name="404.txt"
        title="这页走丢了"
        rule="// 链接可能写错了，或者这篇已经删了"
        closable={false}
      >
        <div className="flex flex-wrap gap-(--space-3)">
          <Button variant="primary" asChild>
            <Link to="/">回首页</Link>
          </Button>
          <Button onClick={() => setSearchOpen(true)}>搜一下</Button>
        </div>
      </Window>
    </SiteShell>
  )
}

export function ErrorWindow({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  return (
    <SiteShell>
      <Window
        id="error"
        name="error.log"
        title="服务器摆烂了"
        rule="// 不是你的问题。再试一次，多半就好了"
        closable={false}
      >
        <p className="muted mb-(--space-4) font-mono text-(length:--text-sm)">{error.message}</p>
        <Button
          variant="primary"
          onClick={() => {
            reset()
            router.invalidate()
          }}
        >
          重试
        </Button>
      </Window>
    </SiteShell>
  )
}

/** 空列表：说明为什么空 */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted py-(--space-4)">{children}</p>
}
