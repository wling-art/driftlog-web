import { useLayoutEffect, useRef, useState } from "react"
import { Popover } from "radix-ui"
import { List } from "lucide-react"

/*
 * 文章目录：宽屏放在左边一列（TocPanel），窄屏是标题栏按钮弹出（TocButton）。
 * 视野条：正文每一节按比例映射到目录对应项，当前可见的正文范围显示为轨道上的一段；滚动时直接改 DOM。
 */

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches

/** 滚动容器：宽屏是文章窗口内容区，窄屏是整页 */
function scrollerOf(): HTMLElement {
  const body = document.querySelector<HTMLElement>("#article .win-body")
  return body && body.scrollHeight > body.clientHeight ? body : (document.scrollingElement as HTMLElement)
}

let gliding: (() => void) | null = null
/** 平滑滚到 el，结束或被打断时调用 done；新的滚动会先停掉上一次 */
function glideTo(el: HTMLElement, done: () => void) {
  gliding?.()
  const box = scrollerOf()
  const page = box === document.scrollingElement
  // 每帧重新计算目标位置
  const target = () => {
    const top = page ? 0 : box.getBoundingClientRect().top
    const to = box.scrollTop + el.getBoundingClientRect().top - top - 16
    return Math.max(0, Math.min(to, box.scrollHeight - box.clientHeight))
  }
  const from = box.scrollTop
  const d0 = target() - from
  if (reduced() || Math.abs(d0) < 2) {
    box.scrollTop = target()
    return done()
  }
  const duration = Math.min(720, 280 + Math.sqrt(Math.abs(d0)) * 9)
  const start = performance.now()
  let frame = 0
  // 最小加加速度曲线，同 --ease-move
  const ease = (t: number) => t * t * t * (10 - 15 * t + 6 * t * t)
  // 滚动期间关闭滚动锚定
  const anchor = box.style.overflowAnchor
  box.style.overflowAnchor = "none"
  const stop = () => {
    cancelAnimationFrame(frame)
    removeEventListener("wheel", stop)
    removeEventListener("touchstart", stop)
    removeEventListener("keydown", stop)
    box.style.overflowAnchor = anchor
    gliding = null
    done()
  }
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    box.scrollTop = from + (target() - from) * ease(t)
    if (t < 1) frame = requestAnimationFrame(step)
    else stop()
  }
  // 滚轮、触摸、按键时停止
  addEventListener("wheel", stop, { passive: true, once: true })
  addEventListener("touchstart", stop, { passive: true, once: true })
  addEventListener("keydown", stop, { once: true })
  gliding = stop
  frame = requestAnimationFrame(step)
}

export type TocItem = { depth: number; id: string; text: string }

/** 每帧更新视野条和可见节；返回当前节 id（用于 aria-current），只在换节时重渲染 */
function useViewportBand(items: TocItem[], wrap: React.RefObject<HTMLDivElement | null>) {
  const [current, setCurrent] = useState<string | null>(null)
  useLayoutEffect(() => {
    const track = wrap.current
    if (!track || !items.length) return
    const box = scrollerOf()
    const page = box === document.scrollingElement
    const target: HTMLElement | Window = page ? window : box
    let frame = 0
    let last: string | null = null
    const measure = () => {
      frame = 0
      const boxTop = page ? 0 : box.getBoundingClientRect().top
      const viewH = page ? innerHeight : box.clientHeight
      const toContent = (el: Element) => el.getBoundingClientRect().top - boxTop + box.scrollTop
      const heads = items.map((it) => {
        const el = document.getElementById(it.id)
        return el ? toContent(el) : NaN
      })
      const prose = document.querySelector("#article .prose")
      const end = prose ? prose.getBoundingClientRect().bottom - boxTop + box.scrollTop : box.scrollHeight
      const lis = [...track.querySelectorAll<HTMLElement>(".toc-list > li")]
      const tops = lis.map((li) => li.offsetTop)
      const tEnd = lis.length ? lis[lis.length - 1]!.offsetTop + lis[lis.length - 1]!.offsetHeight : 0
      // 正文纵坐标按所在节的比例映射到目录纵坐标
      const map = (y: number) => {
        if (!(y > heads[0]!)) return tops[0] ?? 0
        for (let i = 0; i < heads.length; i++) {
          const next = heads[i + 1] ?? end
          if (y < next || i === heads.length - 1) {
            const r = Math.min(1, Math.max(0, (y - heads[i]!) / Math.max(1, next - heads[i]!)))
            return tops[i]! + ((tops[i + 1] ?? tEnd) - tops[i]!) * r
          }
        }
        return tEnd
      }
      const vTop = box.scrollTop
      const vBottom = vTop + viewH
      const bandTop = map(vTop)
      const bandBottom = Math.max(bandTop + 6, map(vBottom))
      track.style.setProperty("--band-top", `${bandTop}px`)
      track.style.setProperty("--band-h", `${bandBottom - bandTop}px`)
      // 标记可见的节
      let now: string | null = null
      lis.forEach((li, i) => {
        const from = heads[i]!
        const to = heads[i + 1] ?? end
        const seen = to > vTop && from < vBottom
        li.toggleAttribute("data-seen", seen)
        if (from <= vTop + viewH * 0.3) now = items[i]!.id
      })
      now ??= items[0]!.id
      if (now !== last) {
        last = now
        setCurrent(now)
        // 把当前项滚进目录自身的可视区
        const pane = track.closest<HTMLElement>(".toc-panel, .toc-pop")
        const li = lis[items.findIndex((it) => it.id === now)]
        if (pane && li && pane.scrollHeight > pane.clientHeight) {
          const r = li.getBoundingClientRect()
          const p = pane.getBoundingClientRect()
          if (r.top < p.top + 32) pane.scrollTop -= p.top + 32 - r.top
          else if (r.bottom > p.bottom - 32) pane.scrollTop += r.bottom - (p.bottom - 32)
        }
      }
    }
    const onScroll = () => (frame ||= requestAnimationFrame(measure))
    measure()
    target.addEventListener("scroll", onScroll, { passive: true })
    addEventListener("resize", onScroll)
    // 正文尺寸变化时重新计算
    const ro = new ResizeObserver(onScroll)
    const prose = document.querySelector("#article .prose")
    if (prose) ro.observe(prose)
    return () => {
      target.removeEventListener("scroll", onScroll)
      removeEventListener("resize", onScroll)
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [items, wrap])
  return current
}

function TocList({ items, onPick }: { items: TocItem[]; onPick?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const current = useViewportBand(items, wrap)
  const min = Math.min(...items.map((i) => i.depth))
  return (
    <div ref={wrap} className="toc-track">
      <span className="toc-read" aria-hidden="true" />
      <span className="toc-band" aria-hidden="true" />
      <ol className="toc-list">
        {items.map((it) => (
          <li key={it.id} style={{ "--level": it.depth - min } as React.CSSProperties}>
            <a
              href={`#${it.id}`}
              aria-current={current === it.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(it.id)
                if (!el) return
                onPick?.()
                // 滚动结束后再写入 #锚点
                glideTo(el, () => history.replaceState(history.state, "", `#${it.id}`))
              }}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 宽屏左边一列的目录 */
export function TocPanel({ items }: { items: TocItem[] }) {
  return (
    <nav className="toc-panel" aria-label="文章目录">
      <p className="toc-heading">目录</p>
      <TocList items={items} />
    </nav>
  )
}

/** 标题栏上的目录按钮（窄屏显示） */
export function TocButton({ items }: { items: TocItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="win-btn toc-button" aria-label="文章目录" title="目录">
        <List aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={6} collisionPadding={8} className="toc-pop">
          <p className="toc-heading">目录</p>
          <TocList items={items} onPick={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
