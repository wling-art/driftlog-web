import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { Link } from "@tanstack/react-router"

import { useTheme } from "./use-theme"

/*
 * Boring UI 桌面：shadcn/ui 里没有的四样东西
 *   <Desktop>      整页就是一块全屏桌面（第 1 层 + 很淡的颗粒），场景写在 scene 上
 *   <Folders>      左边一列文件夹 = 本页目录；窗口被关了，点文件夹能重新打开
 *   <Window>       一个内容区块 = 一个窗口；右上角的 × 真的能关，而且能撤销
 *   <Taskbar>      吸底任务栏：导航标签（当前页升起）+ 主题切换 + 带秒的时钟
 * 样式全在 ../../../../desktop.css（静态 HTML 路线用的是同一份），这里只写结构和行为，class 名和静态版一样。
 * 规则见 references/visual.md「窗口与任务栏」。
 */

type Scene = "read" | "tool" | "touch" | "show"

type WinEntry = { el: HTMLElement | null; close: HTMLButtonElement | null; title: string }
type DesktopCtx = {
  hidden: ReadonlySet<string>
  register: (id: string, entry: WinEntry) => () => void
  open: (id: string) => void
  close: (id: string) => void
}
const Ctx = React.createContext<DesktopCtx | null>(null)

/** 把窗口「叫到前面」：重新播放轻回弹 */
export function bringFront(el: HTMLElement | null) {
  if (!el) return
  el.classList.remove("is-front")
  void el.offsetWidth
  el.classList.add("is-front")
}

/** 焦点交给最新一条提示里的按钮（撤销） */
function focusToastAction(tries = 20) {
  // sonner 挂载提示有一点延迟：每帧找一次，最多等 20 帧
  const btn = document.querySelector<HTMLElement>('[data-sonner-toast][data-index="0"] [data-button]')
  if (btn) btn.focus()
  else if (tries > 0) requestAnimationFrame(() => focusToastAction(tries - 1))
}

export function Desktop({
  scene,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { scene?: Scene }) {
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set())
  const wins = React.useRef(new Map<string, WinEntry>())

  const register = React.useCallback((id: string, entry: WinEntry) => {
    wins.current.set(id, entry)
    return () => void wins.current.delete(id)
  }, [])

  const open = React.useCallback((id: string) => {
    setHidden((h) => {
      if (!h.has(id)) return h
      const n = new Set(h)
      n.delete(id)
      return n
    })
    requestAnimationFrame(() => bringFront(wins.current.get(id)?.el ?? null))
  }, [])

  const close = React.useCallback(
    (id: string) => {
      const win = wins.current.get(id)
      setHidden((h) => new Set(h).add(id))
      toast(`已关闭「${win?.title ?? "窗口"}」`, {
        duration: 5000,
        action: {
          label: "撤销",
          onClick: () => {
            open(id)
            requestAnimationFrame(() => wins.current.get(id)?.close?.focus()) // 撤销后焦点回到这个 ×
          },
        },
        onAutoClose: () => {
          // 提示过期时焦点别跟着丢：落到左边对应的文件夹，窄屏没有文件夹就落到下一个窗口的 ×
          if (!document.activeElement?.closest("[data-sonner-toaster]")) return
          const folder = document.querySelector<HTMLElement>(`[data-folder="${id}"]`)
          if (folder?.offsetParent) return folder.focus()
          for (const w of wins.current.values()) if (w.close?.offsetParent) return w.close.focus()
        },
      })
      focusToastAction()
    },
    [open],
  )

  const value = React.useMemo(() => ({ hidden, register, open, close }), [hidden, register, open, close])

  return (
    <Ctx.Provider value={value}>
      <div data-slot="desktop" data-scene={scene} className={cn("screen", className)} {...props}>
        {children}
      </div>
    </Ctx.Provider>
  )
}

export function DesktopArea({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="desktop-area" className={cn("desktop-area", className)} {...props} />
}

export function Folders({
  className,
  "aria-label": label = "本页目录",
  ...props
}: React.ComponentProps<"nav">) {
  return <nav data-slot="folders" aria-label={label} className={cn("folders", className)} {...props} />
}

/** 一个文件夹 / 文档图标。target 是它对应的窗口 id */
export function Folder({
  target,
  icon = "folder",
  className,
  children,
  onClick,
  ...props
}: Omit<React.ComponentProps<"a">, "href"> & { target: string; icon?: "folder" | "doc" }) {
  const ctx = React.useContext(Ctx)
  return (
    <a
      href={`#${target}`}
      data-folder={target}
      data-icon={icon === "doc" ? "doc" : undefined} // 图标画在 desktop.css 里
      onClick={(e) => {
        onClick?.(e)
        ctx?.open(target)
      }}
      className={cn("folder", className)}
      {...props}
    >
      <span>{children}</span>
    </a>
  )
}

/** 窗口一列最宽 1000px，在桌面上居中 */
export function Windows({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="windows" className={cn("wins", className)} {...props} />
}

/**
 * 一个内容区块 = 一个窗口。
 * name：标题栏上像文件名的小名字（principles.md）；title：窗口里真正的标题（36px 像素字）；rule：一句 // 副标题。
 * closable 默认开：× 关掉后给「已关闭 · 撤销」。放在 <Desktop> 外面时不能关。
 */
export function Window({
  id,
  name,
  title,
  rule,
  closable = true,
  controls,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  id: string
  name: string
  title?: React.ReactNode
  rule?: React.ReactNode
  closable?: boolean
  /** 标题栏右边、× 左边的小控件（比如上一篇 / 下一篇） */
  controls?: React.ReactNode
}) {
  const ctx = React.useContext(Ctx)
  const ref = React.useRef<HTMLElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const titleId = `${id}-title`
  const plainTitle = typeof title === "string" ? title : name
  const drag = useWindowDrag(ref)

  React.useEffect(
    () => ctx?.register(id, { el: ref.current, close: closeRef.current, title: plainTitle }),
    [ctx, id, plainTitle],
  )

  return (
    <section
      ref={ref}
      id={id}
      data-slot="window"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : name}
      hidden={ctx?.hidden.has(id)}
      className={cn("win", className)}
      onPointerDownCapture={drag.raise}
      onKeyDown={drag.onKeyDown}
      {...props}
    >
      <div
        data-slot="window-bar"
        className="win-bar"
        title="拖动标题栏移动窗口，双击复位；键盘：Alt + 方向键"
        onPointerDown={drag.onPointerDown}
        onDoubleClick={drag.reset}
      >
        <span className="name">{name}</span>
        {controls && <span className="win-controls">{controls}</span>}
        {closable && ctx && (
          <button
            ref={closeRef}
            type="button"
            aria-label={`关闭「${plainTitle}」`}
            onClick={() => ctx.close(id)}
            className="win-ctl"
          />
        )}
      </div>
      <div data-slot="window-body" className="win-body">
        {title && <h2 id={titleId}>{title}</h2>}
        {rule && <p className="rule">{rule}</p>}
        {children}
      </div>
    </section>
  )
}

/*
 * 拖动窗口：按住标题栏拖。偏移写在独立的 translate 属性上，不占 transform，
 * 这样「叫到前面」的回弹动画（animation 里的 transform）和拖动互不覆盖。
 * - 点到哪个窗口，哪个就到最上层
 * - 标题栏至少留 64px 在桌面里，拖不丢
 * - 双击标题栏复位；键盘用户：焦点在窗口里时 Alt + 方向键移动（WCAG 2.5.7：拖拽要有不用拖的办法）
 * - 窄屏（≤ 760px，窗口一列排下来）不能拖
 */
let topZ = 1
const canDrag = () => window.matchMedia("(min-width: 761px)").matches

export function useWindowDrag(ref: React.RefObject<HTMLElement | null>) {
  const offset = React.useRef({ x: 0, y: 0 })

  const apply = (x: number, y: number) => {
    const el = ref.current
    if (!el) return
    // 整像素：像素字落在半像素上会糊
    offset.current = { x: Math.round(x), y: Math.round(y) }
    el.style.translate =
      offset.current.x || offset.current.y ? `${offset.current.x}px ${offset.current.y}px` : ""
  }

  /** 把 (x, y) 限制在桌面里：标题栏至少露出 64px 宽、整条高 */
  const clamp = (x: number, y: number) => {
    const el = ref.current
    if (!el) return { x, y }
    // 在桌面里的窗口限制在桌面区域；浮在外面的（比如评论窗口）限制在屏幕里、任务栏上面
    const area = el.closest(".desktop-area")
    const a = area
      ? area.getBoundingClientRect()
      : {
          left: 0,
          top: 0,
          right: innerWidth,
          bottom: document.querySelector(".taskbar")?.getBoundingClientRect().top ?? innerHeight,
        }
    const r = el.getBoundingClientRect()
    const baseLeft = r.left - offset.current.x
    const baseTop = r.top - offset.current.y
    const keep = 64
    return {
      x: Math.min(Math.max(x, a.left + keep - (baseLeft + r.width)), a.right - keep - baseLeft),
      y: Math.min(Math.max(y, a.top - baseTop), a.bottom - 30 - baseTop),
    }
  }

  const raise = () => {
    if (ref.current && canDrag()) ref.current.style.zIndex = String(++topZ)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !canDrag() || (e.target as HTMLElement).closest("button, a")) return
    const el = ref.current
    if (!el) return
    e.preventDefault()
    const bar = e.currentTarget
    bar.setPointerCapture(e.pointerId)
    const start = { px: e.clientX, py: e.clientY, ...offset.current }
    el.classList.add("is-dragging")
    const move = (ev: PointerEvent) => {
      const next = clamp(start.x + ev.clientX - start.px, start.y + ev.clientY - start.py)
      apply(next.x, next.y)
    }
    const up = () => {
      el.classList.remove("is-dragging")
      bar.removeEventListener("pointermove", move)
      bar.removeEventListener("pointerup", up)
      bar.removeEventListener("pointercancel", up)
    }
    bar.addEventListener("pointermove", move)
    bar.addEventListener("pointerup", up)
    bar.addEventListener("pointercancel", up)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key]
    if (!e.altKey || !d || !canDrag()) return
    e.preventDefault()
    raise()
    const next = clamp(offset.current.x + d[0]!, offset.current.y + d[1]!)
    apply(next.x, next.y)
  }

  const reset = () => apply(0, 0)

  // 缩到窄屏时回到原位，免得窗口挂在屏幕外
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 761px)")
    const onChange = () => !mq.matches && apply(0, 0)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { raise, onPointerDown, onKeyDown, reset }
}

// 每秒跳一次的「时间源」。SSR 时是 null：服务器的时间和时区和浏览器不一样，会水合不一致
const subscribeSecond = (cb: () => void) => {
  const t = setInterval(cb, 1000)
  return () => clearInterval(t)
}
const nowSecond = () => Math.floor(Date.now() / 1000)

function Clock() {
  const sec = React.useSyncExternalStore(subscribeSecond, nowSecond, () => null)
  if (sec === null) return <span className="clock" aria-hidden="true" />
  const now = new Date(sec * 1000)
  return (
    <time dateTime={now.toISOString()} className="clock">
      {now.toLocaleString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })}
    </time>
  )
}

/** 任务栏上的小按钮（固定小号，不跟场景变） */
export function TaskbarButton({ className, ...props }: React.ComponentProps<"button">) {
  return <button type="button" className={cn("tb-btn", className)} {...props} />
}

export type TaskbarItem = { href: string; label: string; exact?: boolean }

/** 吸底任务栏。第一个导航标签放站点名，点了回首页 */
export function Taskbar({
  items,
  className,
  children,
}: {
  items: TaskbarItem[]
  className?: string
  children?: React.ReactNode
}) {
  const { theme, toggle } = useTheme()
  return (
    <footer data-slot="taskbar" className={cn("taskbar", className)}>
      <nav aria-label="主导航">
        {/* 用路由的 Link：客户端跳转，当前页自动带 aria-current="page"，标签升起来 */}
        {items.map((it) => (
          <Link key={it.href + it.label} to={it.href} activeOptions={{ exact: it.exact ?? false }}>
            {it.label}
          </Link>
        ))}
      </nav>
      <span className="spacer" />
      {children}
      {/* 窄屏只留「亮色 / 暗色」两个字，任务栏放得下 */}
      <TaskbarButton onClick={toggle} aria-label={theme === "dark" ? "切到亮色" : "切到暗色"}>
        {/* 包在一个 span 里：按钮是 inline-flex 带间距，分开写会在「切到」和「暗色」之间空出一块 */}
        <span>
          <span className="tb-long">切到</span>
          {theme === "dark" ? "亮色" : "暗色"}
        </span>
      </TaskbarButton>
      <Clock />
    </footer>
  )
}
