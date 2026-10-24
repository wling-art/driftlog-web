import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { Link } from "@tanstack/react-router"

import { useTheme } from "./use-theme"

/*
 * Boring UI 桌面组件：Desktop（全屏桌面）、Folders（图标列）、Window（可关闭、拖动、改大小的窗口）、
 * Taskbar（吸底任务栏）。样式在 desktop.css。
 */

type Scene = "read" | "tool" | "touch" | "show"

type WinEntry = { el: HTMLElement | null; close: HTMLButtonElement | null; title: string }
type DesktopCtx = {
  hidden: ReadonlySet<string>
  titleOf: (id: string) => string
  register: (id: string, entry: WinEntry) => () => void
  open: (id: string) => void
  close: (id: string) => void
}
const Ctx = React.createContext<DesktopCtx | null>(null)

/** 重新播放窗口的「叫到前面」动画 */
export function bringFront(el: HTMLElement | null) {
  if (!el) return
  el.classList.remove("is-front")
  void el.offsetWidth
  el.classList.add("is-front")
}

/** 聚焦最新一条提示里的按钮（撤销），最多等 20 帧 */
function focusToastAction(tries = 20) {
  const btn = document.querySelector<HTMLElement>('[data-sonner-toast][data-index="0"] [data-button]')
  if (btn) btn.focus()
  else if (tries > 0) requestAnimationFrame(() => focusToastAction(tries - 1))
}

/** 窗口开关状态；<Desktop> 自带，任务栏放在外层时每页单独包一层 */
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
            requestAnimationFrame(() => wins.current.get(id)?.close?.focus())
          },
        },
        onAutoClose: () => {
          // 提示关闭时焦点若在提示里，移到对应文件夹或下一个窗口的 ×
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

/** 当前桌面的窗口状态 */
export const useDesktop = () => React.useContext(Ctx)

/** 焦点不在可交互元素上时，把空格、翻页、Home / End、↑ ↓ 转给主窗口内容区滚动 */
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

/** 文件夹 / 文档图标，点击打开 id 为 target 的窗口 */
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
      data-icon={icon === "doc" ? "doc" : undefined}
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

/** 窗口列 */
export function Windows({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="windows" className={cn("wins", className)} {...props} />
}

/**
 * 窗口。name：标题栏上的文件名；title：窗口标题；rule：// 副标题。
 * 在 DesktopProvider 里且 closable 时显示 ×
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
  /** 标题栏左边、名字前的控件 */
  lead?: React.ReactNode
  /** 标题栏右边、× 前的控件 */
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
      {/* 右下角改大小把手 */}
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
 * 窗口拖动和改大小（仅宽屏）：拖标题栏移动、拖右下角改大小、双击复位；
 * 键盘 Alt + 方向键移动，加 Shift 改大小。偏移写在 translate 属性上
 */
let topZ = 1
const canDrag = () => window.matchMedia("(min-width: 761px)").matches

export function useWindowDrag(ref: React.RefObject<HTMLElement | null>) {
  const offset = React.useRef({ x: 0, y: 0 })

  const apply = (x: number, y: number) => {
    const el = ref.current
    if (!el) return
    // 取整像素
    offset.current = { x: Math.round(x), y: Math.round(y) }
    el.style.translate =
      offset.current.x || offset.current.y ? `${offset.current.x}px ${offset.current.y}px` : ""
  }

  /** 把偏移限制在桌面区域内（没有桌面区域时是屏幕内、任务栏以上），标题栏至少露出 64px */
  const clamp = (x: number, y: number) => {
    const el = ref.current
    if (!el) return { x, y }
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

  /** 改大小：最小 280 × 160，最宽到桌面右边缘；用 margin-bottom 补差，保持占位高度不变 */
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

  /** 复原位置和大小 */
  const reset = () => {
    apply(0, 0)
    ref.current?.style.removeProperty("width")
    ref.current?.style.removeProperty("height")
    ref.current?.style.removeProperty("flex")
    ref.current?.style.removeProperty("margin-bottom")
    slot.current = null
  }

  // 切到窄屏时复原
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 761px)")
    const onChange = () => !mq.matches && reset()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { raise, onPointerDown, onResizeDown, onKeyDown, reset }
}

// 每秒更新的时间源；服务器快照为 null
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

/** 任务栏按钮 */
export function TaskbarButton({ className, ...props }: React.ComponentProps<"button">) {
  return <button type="button" className={cn("tb-btn", className)} {...props} />
}

export type TaskbarItem = {
  href: string
  label: string
  exact?: boolean
  icon?: "folder" | "doc"
  /** 变化时重新挂载标签，重播升起动画 */
  key?: string
}

/** 吸底任务栏：开始按钮、导航标签、children、主题切换、时钟 */
export function Taskbar({
  items,
  start,
  themeToggle = true,
  className,
  children,
}: {
  items: TaskbarItem[]
  /** 最左边的开始按钮 */
  start?: React.ReactNode
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
      {themeToggle && (
        <TaskbarButton onClick={toggle} aria-label={theme === "dark" ? "切到亮色" : "切到暗色"}>
          {/* 窄屏隐藏「切到」 */}
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
