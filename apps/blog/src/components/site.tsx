import { useState, type ReactNode } from "react"
import { Link, useLocation, useRouter } from "@tanstack/react-router"
import {
  DesktopArea,
  DesktopProvider,
  Folders,
  Taskbar,
  TaskbarButton,
  Window,
  Windows,
  useScrollKeys,
} from "@/components/boring"
import { Button } from "@/components/ui/button"
import { useUI } from "@/lib/store"
import { CommentsFloat, CommentsTaskItem } from "@/components/comments-dock"
import { takeDirection } from "@/lib/keys"
import { entryPath, formatDate } from "@/lib/site"
import { useSite, type EntryCard } from "@/lib/api"

const sections = [
  { href: "/posts", label: "文章" },
  { href: "/notes", label: "手记" },
  { href: "/thinking", label: "动态" },
  { href: "/friends", label: "友链" },
  { href: "/about", label: "关于" },
]

/**
 * 整个站点的外壳：全屏桌面 + 浮动的评论窗口 + 吸底任务栏。放在根布局里，只渲染一次：
 * 换页时任务栏还是同一批元素，只有「当前页」在变，标签升起、落下的过渡才都看得见。
 * 每一页自己的部分（图标和窗口）是 children，见 SiteShell。
 */
export function AppShell({ children }: { children: ReactNode }) {
  useScrollKeys()
  const { title } = useSite()
  const nav = [{ href: "/", label: title, exact: true }, ...sections]
  const online = useUI((s) => s.online)
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  return (
    <div data-slot="desktop" className="screen">
      {children}
      <CommentsFloat />
      <Taskbar items={nav}>
        <CommentsTaskItem />
        {online > 0 && (
          <span className="clock" title="现在在看这个站的人">
            {online} 人在看
          </span>
        )}
        <TaskbarButton onClick={() => setSearchOpen(true)} aria-keyshortcuts="Meta+K Control+K">
          搜索 <kbd className="only-fine font-mono">⌘K</kbd>
        </TaskbarButton>
      </Taskbar>
    </div>
  )
}

/**
 * 每一页自己的桌面：左边一列图标（本页目录 / 栏目快捷方式 / 分类）+ 窗口。
 * children 是主内容；aside 是附属窗口，宽屏时排到右边一栏，窄屏时排在主内容后面。
 * 按地址换 key：换页时这一块重新挂载——窗口列播一次入场动画、滚动位置回到顶部、关掉的窗口也不会带到下一页。
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
  const pathname = useLocation({ select: (l) => l.pathname })
  return (
    <DesktopProvider key={pathname}>
      <DesktopArea data-scene={scene}>
        <Folders>{folders}</Folders>
        <PageWindows aside={aside}>{children}</PageWindows>
      </DesktopArea>
    </DesktopProvider>
  )
}

/**
 * 窗口那一列：挂载时播一次入场动画（desktop.css 的 page-in；SiteShell 按地址换 key，所以每次换页都会重新挂载）。
 * 方向在挂载时读一次：上一篇 / 下一篇、← → 标过方向就从侧面滑进来，否则从下面升上来
 */
function PageWindows({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  const [dir] = useState(takeDirection)
  return (
    <Windows className={aside ? "has-aside" : undefined} data-enter={dir ?? undefined}>
      <main className="wins-main">{children}</main>
      {aside && (
        <aside className="wins-aside" aria-label="相关">
          {aside}
        </aside>
      )}
    </Windows>
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

type ArchiveItem = { slug: string; title: string; publishedAt: string | Date | null }

/**
 * 归档：不分页，按年份分组，一行一篇（日期 + 标题）。
 * 个人博客几十到几百篇，一页放得下，翻页按钮也就不需要了。
 */
export function Archive({ items, type }: { items: ArchiveItem[]; type: "post" | "note" }) {
  const years = new Map<number, ArchiveItem[]>()
  for (const it of items) {
    const y = new Date(it.publishedAt ?? 0).getFullYear()
    years.set(y, [...(years.get(y) ?? []), it])
  }
  return (
    <div className="archive">
      {[...years].map(([year, list]) => (
        <section key={year} aria-labelledby={`y-${year}`}>
          <h3 id={`y-${year}`} className="archive-year">
            {year}
            <span className="muted"> · {list.length} 篇</span>
          </h3>
          <ul className="archive-list">
            {list.map((it) => (
              <li key={it.slug}>
                <Link to={entryPath(type, it.slug)} className="archive-row">
                  <time dateTime={String(it.publishedAt)}>{formatDate(it.publishedAt).slice(5)}</time>
                  <span className="t">{it.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
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
