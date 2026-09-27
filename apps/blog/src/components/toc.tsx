import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Popover } from "radix-ui"
import { List } from "lucide-react"

/*
 * 文章目录：一张按层级缩进的文字清单（不再是一排文件图标——图标标签截成两行、看不出层级，也不知道读到哪了）。
 *   宽屏：放在左边那一列，跟着阅读位置高亮当前这一节
 *   窄一点：标题栏上一个「目录」按钮，点开同一张清单
 * 点一项：用「移动」曲线（最小加加速度）滑过去，距离越远时间越长（280–720ms）；滑的途中高亮直接落在目标上，
 * 不一节一节闪过去；读者自己一滚就停下来交还控制。
 * 左边一条「读到哪」的轨道：点点虚线是没读的，读过的部分变成实线；当前一节有个像素小方块，
 * 移动时带一点过冲、拉长一下再落稳（squash & stretch）。减少动态时这些都直接到位。
 */

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches

/** 滚动的是谁：宽屏是文章窗口的内容区，窄屏是整页 */
function scrollerOf(): HTMLElement {
  const body = document.querySelector<HTMLElement>("#article .win-body")
  return body && body.scrollHeight > body.clientHeight ? body : (document.scrollingElement as HTMLElement)
}

let gliding: (() => void) | null = null
/** 平滑滚到 el，结束（或被读者打断）时回调。再点别的会先停掉上一次 */
function glideTo(el: HTMLElement, done: () => void) {
  gliding?.()
  const box = scrollerOf()
  const page = box === document.scrollingElement
  // 目标每一帧重新量：路上的懒加载图片一出来，下面的标题就往下挪，量一次会停错地方
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
  // 最小加加速度曲线：起步和停下都很柔，和 --ease-move 同源
  const ease = (t: number) => t * t * t * (10 - 15 * t + 6 * t * t)
  // 滑的时候关掉浏览器的滚动锚定，不然它和我们一起调位置会来回抖
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
  // 读者自己一动（滚轮、触摸、按键）就停，别跟人抢
  addEventListener("wheel", stop, { passive: true, once: true })
  addEventListener("touchstart", stop, { passive: true, once: true })
  addEventListener("keydown", stop, { once: true })
  gliding = stop
  frame = requestAnimationFrame(step)
}

export type TocItem = { depth: number; id: string; text: string }

/** 现在读到哪一节：最后一个顶端已经过了窗口上沿（留 96px）的标题 */
function useActiveHeading(items: TocItem[]) {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    if (!items.length) return
    const body = document.querySelector<HTMLElement>("#article .win-body")
    const scroller: HTMLElement | Window = body && body.scrollHeight > body.clientHeight ? body : window
    let frame = 0
    const update = () => {
      frame = 0
      const top = scroller === window ? 0 : (scroller as HTMLElement).getBoundingClientRect().top
      let current: string | null = null
      for (const it of items) {
        const el = document.getElementById(it.id)
        if (el && el.getBoundingClientRect().top - top <= 96) current = it.id
        else if (el) break
      }
      setActive(current ?? items[0]!.id)
    }
    const onScroll = () => (frame ||= requestAnimationFrame(update))
    update()
    scroller.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      scroller.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [items])
  return active
}

function TocList({ items, onPick }: { items: TocItem[]; onPick?: () => void }) {
  const spied = useActiveHeading(items)
  // 滑动途中高亮钉在目标上
  const [pinned, setPinned] = useState<string | null>(null)
  const active = pinned ?? spied
  const min = Math.min(...items.map((i) => i.depth))

  // 轨道：小方块移到当前这一项的中间（CSS 过渡，带过冲），实线跟着长到那里；
  // 每次换项再用 Web Animations 播一次「拉长再落稳」
  const wrap = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLSpanElement>(null)
  const last = useRef<string | null>(null)
  useLayoutEffect(() => {
    const box = wrap.current
    const a = active ? box?.querySelector<HTMLElement>(`a[href="#${CSS.escape(active)}"]`) : null
    if (!box || !a) return
    const li = a.parentElement!
    box.style.setProperty("--mark-y", `${li.offsetTop + li.offsetHeight / 2}px`)
    if (last.current && last.current !== active && !reduced()) {
      mark.current?.animate(
        [
          { scale: "1 1" },
          { scale: "0.7 2.6", offset: 0.35 },
          { scale: "1.25 0.8", offset: 0.75 },
          { scale: "1 1" },
        ],
        { duration: 420, easing: "ease-out" },
      )
    }
    last.current = active
    // 当前项在目录自己的滚动区里也要看得见（只滚目录，不动页面）
    const pane = box.closest<HTMLElement>(".toc-panel, .toc-pop")
    if (pane && pane.scrollHeight > pane.clientHeight) {
      const r = a.getBoundingClientRect()
      const p = pane.getBoundingClientRect()
      if (r.top < p.top + 32) pane.scrollTop -= p.top + 32 - r.top
      else if (r.bottom > p.bottom - 32) pane.scrollTop += r.bottom - (p.bottom - 32)
    }
  }, [active])

  return (
    <div ref={wrap} className="toc-track">
      <span className="toc-rail" aria-hidden="true" />
      <span ref={mark} className="toc-mark" aria-hidden="true" />
      <ol className="toc-list">
        {items.map((it) => (
          <li key={it.id} style={{ "--level": it.depth - min } as React.CSSProperties}>
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(it.id)
                if (!el) return
                setPinned(it.id)
                onPick?.()
                // 地址栏的 #锚点等滑到了再写：先写的话路由会自己「跳」过去一帧，滑动前闪一下
                glideTo(el, () => {
                  setPinned(null)
                  history.replaceState(history.state, "", `#${it.id}`)
                })
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

/** 宽屏左边那一列 */
export function TocPanel({ items }: { items: TocItem[] }) {
  return (
    <nav className="toc-panel" aria-label="文章目录">
      <p className="toc-heading">目录</p>
      <TocList items={items} />
    </nav>
  )
}

/** 标题栏上的「目录」按钮（左边那一列放不下时才出现） */
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
