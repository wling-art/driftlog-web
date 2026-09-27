import { useLayoutEffect, useRef, useState } from "react"
import { Popover } from "radix-ui"
import { List } from "lucide-react"

/*
 * 文章目录：一张按层级缩进的文字清单（不再是一排文件图标——图标标签截成两行、看不出层级，也不知道读到哪了）。
 *   宽屏：放在左边那一列；窄一点：标题栏上一个「目录」按钮，点开同一张清单
 * 「读到哪」按你眼睛看到的来（参考 Shiro：看得见的标题才算），而不是只算最后一个过了顶的标题：
 *   把正文每一节（这个标题到下一个标题）按比例对应到目录里这一项（这一项顶到下一项顶），
 *   屏幕上看得见的那一段正文就是目录轨道上一截粗的「视野条」，随滚动连续地滑、连续地伸缩（像编辑器的缩略图）；
 *   视野里的每一节都亮起来；视野条上面是读过的实线，下面是没读的点点虚线。
 * 滚动时直接改 DOM（CSS 变量、data 属性），不走 React 渲染，才跟得上每一帧。
 * 点一项：用「移动」曲线滑过去（280–720ms，读者一动就停），视野条跟着一路滑过去。
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

/**
 * 视野条：每一帧量一次标题位置和视野，按比例换算成目录上的纵坐标。
 * 返回「屏幕上半部分所在的那一节」给读屏（aria-current），只在换节时触发一次渲染
 */
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
      // 正文纵坐标 → 目录纵坐标：落在第 i 节里就按它在这一节里的比例，放到第 i 项和第 i+1 项之间
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
      // 视野里的每一节都亮
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
        // 当前项在目录自己的滚动区里也要看得见（只滚目录，不动页面）
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
    // 图片加载完正文会变长：量一次
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
                // 地址栏的 #锚点等滑到了再写：先写的话路由会自己「跳」过去一帧，滑动前闪一下
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
