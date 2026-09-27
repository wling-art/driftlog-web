import { useEffect, useState } from "react"
import { Popover } from "radix-ui"
import { List } from "lucide-react"

/*
 * 文章目录：一张按层级缩进的文字清单（不再是一排文件图标——图标标签截成两行、看不出层级，也不知道读到哪了）。
 *   宽屏：放在左边那一列，跟着阅读位置高亮当前这一节
 *   窄一点：标题栏上一个「目录」按钮，点开同一张清单
 * 点一项：在窗口里平滑滚到那一节（宽屏窗口自己滚，窄屏整页滚，scrollIntoView 两种都管）
 */

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
  const active = useActiveHeading(items)
  const min = Math.min(...items.map((i) => i.depth))
  return (
    <ol className="toc-list">
      {items.map((it) => (
        <li key={it.id} style={{ "--level": it.depth - min } as React.CSSProperties}>
          <a
            href={`#${it.id}`}
            aria-current={active === it.id ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(it.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
              history.replaceState(null, "", `#${it.id}`)
              onPick?.()
            }}
          >
            {it.text}
          </a>
        </li>
      ))}
    </ol>
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
