import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
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
import { ChevronLeft } from "lucide-react"
import { markDirection, takeDirection, useArrowNav } from "@/lib/keys"
import { entryPath, formatDate } from "@/lib/site"
import { useSite, type EntryCard } from "@/lib/api"

// 栏目的中文名（任务栏上「当前打开的窗口」用）
const sectionName: Record<string, string> = {
  posts: "文章",
  notes: "手记",
  thinking: "动态",
  projects: "项目",
  says: "一言",
  friends: "友链",
}

/** 没有页面给路径时，按地址猜：/notes → 手记，/posts/x → 文章 / x */
function guessCrumbs(pathname: string): Crumb[] {
  const [, first, second] = pathname.split("/")
  if (!first) return []
  const section = sectionName[first]
  if (!section) return [{ label: decodeURIComponent(first) }]
  return second
    ? [{ label: section, to: `/${first}` }, { label: decodeURIComponent(second) }]
    : [{ label: section }]
}

/**
 * 任务栏上的路径（像文件管理器的地址栏）：wling: / 手记 / 随想 / 走个面儿
 * 盘符是站长的名字，点了回首页；中间每一段都能点回那一级；最后一段是当前页，像升起的标签。
 * 换页时各段依次从下面升起来；窄屏只留盘符和最后一段，中间收成「…」
 */
function PathBar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const { owner } = useSite()
  const given = useUI((s) => s.crumbs)
  const crumbs = given ?? guessCrumbs(pathname)
  const last = crumbs.length - 1
  return (
    <nav aria-label="你在这里" className="pathbar" key={pathname}>
      <ol>
        <li style={{ "--i": 0 } as React.CSSProperties}>
          {crumbs.length ? (
            <Link to="/" className="pathbar-seg pathbar-root">
              {owner.name}:
            </Link>
          ) : (
            <span className="pathbar-seg pathbar-root" aria-current="page">
              {owner.name}:
            </span>
          )}
        </li>
        {crumbs.map((c, i) => (
          <li
            key={i}
            style={{ "--i": i + 1 } as React.CSSProperties}
            className={i < last ? "pathbar-mid" : undefined}
          >
            <span className="pathbar-sep" aria-hidden="true">
              /
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

/**
 * 整个站点的外壳：全屏桌面 + 浮动的评论窗口 + 吸底任务栏。放在根布局里，只渲染一次：
 * 换页时任务栏还是同一批元素，只有「当前页」在变，标签升起、落下的过渡才都看得见。
 * 每一页自己的部分（图标和窗口）是 children，见 SiteShell。
 */
export function AppShell({ children }: { children: ReactNode }) {
  useScrollKeys()
  const online = useUI((s) => s.online)
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  return (
    <div data-slot="desktop" className="screen">
      {children}
      <CommentsFloat />
      <AccountDialog />
      {/* 左边：开始菜单 + 你在哪（路径）；主题和账号收进开始菜单 */}
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
        {/* 这一页关掉的窗口（ClosedTasks 从页面里传送过来） */}
        <span id="tb-closed" className="tb-closed" />
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
  crumbs,
  children,
}: {
  folders?: ReactNode
  scene?: "read" | "show"
  aside?: ReactNode
  /** 任务栏上的路径（不含盘符）。不给就按地址猜 */
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
      <DesktopArea data-scene={scene}>
        <Folders>{folders}</Folders>
        <PageWindows aside={aside}>{children}</PageWindows>
      </DesktopArea>
      <ClosedTasks />
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

type ArchiveItem = {
  slug: string
  title: string
  publishedAt: string | Date | null
  mood?: string | null
  weather?: string | null
  topic?: string | null
}

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
    // 手记是时间线（竖线 + 圆点，标题下一行小字：专栏 · 心情 · 天气）；文章是普通年表
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
                  <time dateTime={String(it.publishedAt)}>{formatDate(it.publishedAt).slice(5)}</time>
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

/** 空列表：说明为什么空 */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted py-(--space-4)">{children}</p>
}

/**
 * 标题栏左边的「‹ 上一级」：每个不是首页的窗口都有，Esc 同效。
 * 上一级由页面决定：栏目回首页，分类 / 专栏 / 标签回栏目，详情回列表
 */
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

/**
 * 分类 / 专栏的简介（参考 Shiro 的专栏页头）：像文件夹的「属性」卡片。
 * 左边一个小文件夹图标，右边一句话介绍、正文段落。分量比窗口标题和列表轻：字不放大、卡片不厚。
 * 篇数和最近一篇写在窗口的 // 副标题里，不在这里重复。
 * 正文长了只露第一段，剩下的收在「继续读」里（原生 details，不用 JS）
 */
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

/**
 * 关掉的窗口留在任务栏上（像最小化的程序）：点一下就回来。
 * 窗口状态在每页自己的 DesktopProvider 里，任务栏在根布局里，所以用 portal 放进任务栏的空位
 */
const noSubscribe = () => () => {}
function ClosedTasks() {
  const desk = useDesktop()
  // 任务栏的空位：服务器上没有（null），浏览器里取一次
  const slot = useSyncExternalStore(
    noSubscribe,
    () => document.getElementById("tb-closed"),
    () => null,
  )
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
