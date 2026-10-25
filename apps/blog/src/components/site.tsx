import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Link, useLocation, useRouter } from "@tanstack/react-router"
import {
  DesktopArea,
  DesktopProvider,
  Folders,
  Taskbar,
  TaskbarButton,
  Window,
  Windows,
  useDesktop,
  useScrollKeys,
} from "@/components/boring"
import { Button } from "@/components/ui/button"
import { useUI, type Crumb } from "@/lib/store"
import { CommentsFloat, CommentsTaskItem } from "@/components/comments-dock"
import { AccountDialog } from "@/components/account"
import { StartMenu } from "@/components/start-menu"
import { OnlineCount } from "@/components/online"
import { ChevronLeft } from "lucide-react"
import { markDirection, takeDirection, useArrowNav } from "@/lib/keys"
import { entryPath, formatDate, useHydrated } from "@/lib/site"
import type { EntryCard } from "@/lib/api"

const sectionName: Record<string, string> = {
  posts: "文章",
  notes: "手记",
  thinking: "动态",
  projects: "项目",
  says: "一言",
  friends: "友链",
}

/** 按地址推断路径：/notes → 手记，/posts/x → 文章 / x */
function guessCrumbs(pathname: string): Crumb[] {
  const [, first, second] = pathname.split("/")
  if (!first) return [{ label: "首页" }]
  const section = sectionName[first]
  if (!section) return [{ label: decodeURIComponent(first) }]
  return second
    ? [{ label: section, to: `/${first}` }, { label: decodeURIComponent(second) }]
    : [{ label: section }]
}

/** 任务栏上的地址栏：⌂ › 手记 › 专栏 › 标题，中间各段可点 */
function PathBar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const given = useUI((s) => s.crumbs)
  const crumbs = given ?? guessCrumbs(pathname)
  const last = crumbs.length - 1
  return (
    <nav aria-label="你在这里" className="pathbar">
      <ol>
        <li>
          <Link to="/" className="pathbar-seg pathbar-home" aria-label="首页" title="首页" />
        </li>
        {crumbs.map((c, i) => (
          <li key={i} className={i < last ? "pathbar-mid" : "pathbar-last"}>
            <span className="pathbar-sep" aria-hidden="true">
              ›
            </span>
            {i < last && c.to ? (
              <Link
                to={c.to}
                search={c.search ?? {}}
                className="pathbar-seg"
                onClick={() => markDirection("back")}
              >
                {c.label}
              </Link>
            ) : (
              <span className="pathbar-seg" aria-current={i === last ? "page" : undefined} title={c.label}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** 站点外壳：桌面、评论浮窗、账号弹窗、任务栏。在根布局里渲染一次，页面内容是 children */
export function AppShell({ children }: { children: ReactNode }) {
  useScrollKeys()
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  return (
    <div data-slot="desktop" className="screen">
      {children}
      <CommentsFloat />
      <AccountDialog />
      <Taskbar
        items={[]}
        start={
          <>
            <StartMenu />
            <PathBar />
          </>
        }
        themeToggle={false}
      >
        {/* 本页关掉的窗口，由 ClosedTasks 传送进来 */}
        <span id="tb-closed" className="tb-closed" />
        <CommentsTaskItem />
        <OnlineCount />
        <TaskbarButton onClick={() => setSearchOpen(true)} aria-keyshortcuts="Meta+K Control+K">
          搜索 <kbd className="only-fine font-mono">⌘K</kbd>
        </TaskbarButton>
      </Taskbar>
    </div>
  )
}

/**
 * 每页的桌面区域：左边图标列（或目录）+ 窗口列。children 是主内容，aside 是右栏窗口。
 * 按地址做 key，换页时重新挂载
 */
export function SiteShell({
  folders,
  toc,
  scene,
  aside,
  crumbs,
  children,
}: {
  folders?: ReactNode
  /** 左边一列放目录而不是图标 */
  toc?: ReactNode
  scene?: "read" | "show"
  aside?: ReactNode
  /** 任务栏路径；不给就按地址推断 */
  crumbs?: Crumb[]
  children: ReactNode
}) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const setCrumbs = useUI((s) => s.setCrumbs)
  const crumbKey = JSON.stringify(crumbs ?? null)
  useEffect(() => {
    setCrumbs(JSON.parse(crumbKey) as Crumb[] | null)
    return () => setCrumbs(null)
  }, [crumbKey, setCrumbs])
  return (
    <DesktopProvider key={pathname}>
      <DesktopArea data-scene={scene} className={toc ? "has-toc" : undefined}>
        {toc ?? <Folders>{folders}</Folders>}
        <PageWindows aside={aside}>{children}</PageWindows>
      </DesktopArea>
      <ClosedTasks />
    </DesktopProvider>
  )
}

/** 窗口列；挂载时读一次换页方向，给入场动画用 */
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

/** 文章 / 手记列表，整行是链接 */
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
            <time dateTime={formatDate(e.publishedAt ?? e.createdAt)}>
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

type ArchiveItem = {
  slug: string
  title: string
  publishedAt: string | Date | null
  mood?: string | null
  weather?: string | null
  topic?: string | null
}

/** 归档：按年份分组，不分页；手记显示为时间线 */
export function Archive({ items, type }: { items: ArchiveItem[]; type: "post" | "note" }) {
  const years = new Map<string, ArchiveItem[]>()
  for (const it of items) {
    const y = formatDate(it.publishedAt).slice(0, 4)
    const list = years.get(y)
    if (list) list.push(it)
    else years.set(y, [it])
  }
  return (
    <div className="archive" data-timeline={type === "note" || undefined}>
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
                  <time dateTime={formatDate(it.publishedAt)}>{formatDate(it.publishedAt).slice(5)}</time>
                  <span className="t">{it.title}</span>
                  {type === "note" && (it.topic || it.mood || it.weather) && (
                    <span className="m">{[it.topic, it.mood, it.weather].filter(Boolean).join(" · ")}</span>
                  )}
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
      <Window id="lost" name="404.txt" title="这页走丢了" rule="// 链接可能写错了，或者这篇已经删了">
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
      <Window id="error" name="error.log" title="服务器摆烂了" rule="// 不是你的问题。再试一次，多半就好了">
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

/** 空列表提示 */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted py-(--space-4)">{children}</p>
}

/** 标题栏左边的「‹ 上一级」链接，同时绑定 Esc */
export function BackLink({
  to,
  search,
  label,
}: {
  to: string
  search?: Record<string, string>
  label: string
}) {
  useArrowNav(null, null, { to, search: search ?? {} })
  return (
    <Link
      to={to}
      search={search ?? {}}
      onClick={() => markDirection("back")}
      className="win-back"
      aria-label={`回到${label}（Esc）`}
      title="回到上一级（Esc）"
    >
      <ChevronLeft aria-hidden="true" />
      {label}
    </Link>
  )
}

/** 分类 / 专栏简介卡片：一句话介绍 + 第一段，其余段落收进「继续读」 */
export function FolderIntro({ lead, body }: { lead?: string; body?: string }) {
  const paras = (body ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!lead && !paras.length) return null
  const [first, ...rest] = paras
  return (
    <section className="folder-intro" aria-label="简介">
      <span className="folder-intro-icon" aria-hidden="true" />
      <div className="folder-intro-text">
        {lead && <p className="folder-intro-lead">{lead}</p>}
        {first && <p>{first}</p>}
        {rest.length > 0 && (
          <details>
            <summary>继续读</summary>
            {rest.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </details>
        )}
      </div>
    </section>
  )
}

/** 本页关掉的窗口：portal 到任务栏的 #tb-closed，点击恢复 */
function ClosedTasks() {
  const desk = useDesktop()
  const hydrated = useHydrated()
  const slot = hydrated ? document.getElementById("tb-closed") : null
  if (!slot || !desk?.hidden.size) return null
  return createPortal(
    [...desk.hidden].map((id) => (
      <TaskbarButton
        key={id}
        className="tb-restore"
        onClick={() => desk.open(id)}
        title={`恢复「${desk.titleOf(id)}」`}
        aria-label={`恢复窗口「${desk.titleOf(id)}」`}
      >
        {desk.titleOf(id)}
      </TaskbarButton>
    )),
    slot,
  )
}
