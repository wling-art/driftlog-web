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
  /** 窗口标题（关掉的窗口在任务栏上用它） */
  titleOf: (id: string) => string
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

/**
 * 窗口的开 / 关状态（× 关掉、撤销、文件夹重新打开）。
 * 一般用 <Desktop>；任务栏要跨页面常驻时（比如前端路由的根布局里放任务栏），
 * 每一页单独包一层 <DesktopProvider>，外面自己写 .screen。
 */
export function DesktopProvider({ children }: { children: React.ReactNode }) {
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

  const titleOf = React.useCallback((id: string) => wins.current.get(id)?.title ?? "窗口", [])
  const value = React.useMemo(
    () => ({ hidden, titleOf, register, open, close }),
    [hidden, titleOf, register, open, close],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** 当前这页桌面的窗口状态（任务栏上列出关掉的窗口、点了恢复） */
export const useDesktop = () => React.useContext(Ctx)

/**
 * 宽屏下整页不滚、窗口自己滚。焦点不在任何东西上时（刚打开页面、点了桌面空白处），
 * 空格、PageUp / PageDown、Home / End、↑ ↓ 交给主窗口的内容区，键盘用户照样能读
 */
export function useScrollKeys() {
  React.useEffect(() => {
    const keys: Record<string, (el: HTMLElement, shift: boolean) => ScrollToOptions> = {
      " ": (el, shift) => ({ top: (shift ? -1 : 1) * el.clientHeight * 0.85 }),
      PageDown: (el) => ({ top: el.clientHeight * 0.85 }),
      PageUp: (el) => ({ top: -el.clientHeight * 0.85 }),
      ArrowDown: () => ({ top: 48 }),
      ArrowUp: () => ({ top: -48 }),
      Home: (el) => ({ top: -el.scrollHeight }),
      End: (el) => ({ top: el.scrollHeight }),
    }
    const onKey = (e: KeyboardEvent) => {
      const by = keys[e.key]
      if (!by || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      // 焦点在窗口内容里、输入框里、按钮上（空格是按按钮）时交给浏览器自己处理
      const active = document.activeElement
      if (
        active?.closest(
          ".win-body, [role=dialog], input, textarea, select, [contenteditable], button, summary, [role=button]",
        )
      )
        return
      const body = document.querySelector<HTMLElement>(
        ".wins-main > .win:not([data-closed]) > .win-body, .wins > .win:not([data-closed]) > .win-body",
      )
      if (!body || body.scrollHeight <= body.clientHeight) return
      e.preventDefault()
      body.scrollBy({ ...by(body, e.shiftKey), behavior: "smooth" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}

export function Desktop({
  scene,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { scene?: Scene }) {
  useScrollKeys()
  return (
    <DesktopProvider>
      <div data-slot="desktop" data-scene={scene} className={cn("screen", className)} {...props}>
        {children}
      </div>
    </DesktopProvider>
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
  lead,
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
  /** 标题栏最左边、名字前面的控件（比如「‹ 返回」） */
  lead?: React.ReactNode
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
      data-closed={ctx?.hidden.has(id) || undefined}
      inert={ctx?.hidden.has(id) || undefined}
      className={cn("win", className)}
      onPointerDownCapture={drag.raise}
      onKeyDown={drag.onKeyDown}
      {...props}
    >
      <div
        data-slot="window-bar"
        className="win-bar"
        title="拖动标题栏移动窗口，拖右下角改大小，双击复位；键盘：Alt + 方向键移动，再按住 Shift 改大小"
        onPointerDown={drag.onPointerDown}
        onDoubleClick={drag.reset}
      >
        {lead ? (
          <span className="win-lead">
            {lead}
            <span className="name">{name}</span>
          </span>
        ) : (
          <span className="name">{name}</span>
        )}
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
      {/* 右下角拖着改大小（宽屏）；键盘：Alt + Shift + 方向键 */}
      <span
        className="win-resize"
        aria-hidden="true"
        onPointerDown={drag.onResizeDown}
        onDoubleClick={drag.reset}
      />
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

  /**
   * 改大小：左上角不动，右下角跟着指针走。最小 280 × 160；最大到桌面右边缘、高不超过桌面（CSS 的 max-height 兜底）。
   * 窗口之间互不影响：改大小前记下它在排版里占的位置（高 + 下外边距），之后用下外边距补差，
   * 占的位置永远不变——变大就盖在下面的窗口上，变小就留出空，下面的窗口都不动。
   * 也不参与一栏里的伸缩（flex: none），不然会被挤回去
   */
  const slot = React.useRef<{ h: number; mb: number } | null>(null)
  const resize = (w: number, h: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    slot.current ??= { h: r.height, mb: parseFloat(getComputedStyle(el).marginBottom) || 0 }
    const right = el.closest(".desktop-area")?.getBoundingClientRect().right ?? innerWidth
    const height = Math.round(Math.max(h, 160))
    el.style.width = `${Math.round(Math.min(Math.max(w, 280), right - r.left))}px`
    el.style.height = `${height}px`
    el.style.flex = "none"
    el.style.marginBottom = `${slot.current.mb + slot.current.h - height}px`
  }

  const onResizeDown = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current
    if (e.button !== 0 || !el || !canDrag()) return
    e.preventDefault()
    e.stopPropagation()
    raise()
    const grip = e.currentTarget
    grip.setPointerCapture(e.pointerId)
    const r = el.getBoundingClientRect()
    const start = { px: e.clientX, py: e.clientY, w: r.width, h: r.height }
    el.classList.add("is-resizing")
    const move = (ev: PointerEvent) =>
      resize(start.w + ev.clientX - start.px, start.h + ev.clientY - start.py)
    const up = () => {
      el.classList.remove("is-resizing")
      grip.removeEventListener("pointermove", move)
      grip.removeEventListener("pointerup", up)
      grip.removeEventListener("pointercancel", up)
    }
    grip.addEventListener("pointermove", move)
    grip.addEventListener("pointerup", up)
    grip.addEventListener("pointercancel", up)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key]
    if (!e.altKey || !d || !canDrag()) return
    e.preventDefault()
    raise()
    if (e.shiftKey) {
      const r = ref.current!.getBoundingClientRect()
      return resize(r.width + d[0]!, r.height + d[1]!)
    }
    const next = clamp(offset.current.x + d[0]!, offset.current.y + d[1]!)
    apply(next.x, next.y)
  }

  /** 双击标题栏（或右下角）：位置和大小都复原 */
  const reset = () => {
    apply(0, 0)
    ref.current?.style.removeProperty("width")
    ref.current?.style.removeProperty("height")
    ref.current?.style.removeProperty("flex")
    ref.current?.style.removeProperty("margin-bottom")
    slot.current = null
  }

  // 缩到窄屏时回到原位，免得窗口挂在屏幕外
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 761px)")
    const onChange = () => !mq.matches && reset()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { raise, onPointerDown, onResizeDown, onKeyDown, reset }
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

export type TaskbarItem = {
  href: string
  label: string
  exact?: boolean
  /** 标签前的小图标（desktop.css 里画好的） */
  icon?: "folder" | "doc"
  /** 换了 key 标签就重新挂载，播一次升起动画（当前窗口换了） */
  key?: string
}

/** 吸底任务栏。第一个导航标签放站点名，点了回首页 */
export function Taskbar({
  items,
  start,
  themeToggle = true,
  className,
  children,
}: {
  items: TaskbarItem[]
  /** 最左边的「开始」按钮（开始菜单）；有它时导航标签一般只放当前打开的那一个 */
  start?: React.ReactNode
  /** 主题切换放在任务栏右边；放进开始菜单时关掉 */
  themeToggle?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const { theme, toggle } = useTheme()
  return (
    <footer data-slot="taskbar" className={cn("taskbar", className)}>
      {start}
      {items.length > 0 && (
        <nav aria-label={start ? "打开的窗口" : "主导航"}>
          {/* 用路由的 Link：客户端跳转，当前页自动带 aria-current="page"，标签升起来 */}
          {items.map((it) => (
            <Link
              key={it.key ?? it.href + it.label}
              to={it.href}
              activeOptions={{ exact: it.exact ?? false }}
              data-icon={it.icon}
              title={it.label}
            >
              <span className="tb-label">{it.label}</span>
            </Link>
          ))}
        </nav>
      )}
      <span className="spacer" />
      {children}
      {/* 窄屏只留「亮色 / 暗色」两个字，任务栏放得下 */}
      {themeToggle && (
        <TaskbarButton onClick={toggle} aria-label={theme === "dark" ? "切到亮色" : "切到暗色"}>
          {/* 包在一个 span 里：按钮是 inline-flex 带间距，分开写会在「切到」和「暗色」之间空出一块 */}
          <span>
            <span className="tb-long">切到</span>
            {theme === "dark" ? "亮色" : "暗色"}
          </span>
        </TaskbarButton>
      )}
      <Clock />
    </footer>
  )
}
