import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { TaskbarButton, useWindowDrag } from "@/components/boring"
import { Comments } from "@/components/comments"
import { commentsQuery } from "@/lib/api"
import { useUI } from "@/lib/store"

// 评论在任务栏上的按钮和可拖动的浮窗

// 曲线同 tokens.css：弹出 400ms 轻回弹，收起 160ms
const easePop = [0.29, 0.45, 0.07, 1.14] as const
const easeExit = [0.88, 0.15, 0.63, 0.58] as const
const easeEnter = [0.37, 0.42, 0.12, 0.85] as const

/** 任务栏上的「评论 N」 */
export function CommentsTaskItem() {
  const target = useUI((s) => s.comments)
  const open = useUI((s) => s.commentsOpen)
  const setOpen = useUI((s) => s.setCommentsOpen)
  const { data } = useQuery({ ...commentsQuery(target?.entryId ?? 0), enabled: !!target })
  const count = data?.length

  // 窗口没开时评论数变多，数字跳一下
  const last = useRef<number | undefined>(undefined)
  const [bump, setBump] = useState(0)
  useEffect(() => {
    if (count !== undefined && last.current !== undefined && count > last.current && !open)
      setBump((b) => b + 1)
    last.current = count
  }, [count, open])

  if (!target) return null
  return (
    <TaskbarButton
      id="comments-task"
      aria-expanded={open}
      aria-controls="comments-float"
      onClick={() => setOpen(!open)}
      className="comments-task"
    >
      评论
      {count !== undefined && (
        <span key={bump} className={bump ? "task-count is-bumped" : "task-count"}>
          {count}
        </span>
      )}
    </TaskbarButton>
  )
}

/** 浮在桌面上的 comments.log 窗口 */
export function CommentsFloat() {
  const target = useUI((s) => s.comments)
  const open = useUI((s) => s.commentsOpen)
  const setOpen = useUI((s) => s.setCommentsOpen)
  const ref = useRef<HTMLElement>(null)
  const drag = useWindowDrag(ref)

  const close = () => {
    setOpen(false)
    document.getElementById("comments-task")?.focus()
  }

  // 地址带 #comment… 时自动打开
  useEffect(() => {
    if (target && /^#comment/.test(location.hash)) setOpen(true)
  }, [target, setOpen])

  // 打开后聚焦窗口，并滚到锚点指向的评论
  useEffect(() => {
    if (!open) return
    ref.current?.focus({ preventScroll: true })
    const hash = location.hash.slice(1)
    if (!hash.startsWith("comment-")) return
    let tries = 0
    const find = () => {
      const el = document.getElementById(hash)
      if (el) el.scrollIntoView({ block: "center" })
      else if (tries++ < 20) setTimeout(find, 100) // 等评论加载，最多 2 秒
    }
    find()
  }, [open])

  return (
    <AnimatePresence>
      {open && target && (
        <motion.section
          ref={ref}
          key="comments-float"
          id="comments-float"
          role="dialog"
          aria-modal="false"
          aria-label={`评论：${target.title}`}
          tabIndex={-1}
          className="win comments-float"
          onPointerDownCapture={drag.raise}
          onKeyDown={(e) => {
            drag.onKeyDown(e)
            if (e.key === "Escape" && !e.defaultPrevented) close()
          }}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              y: { duration: 0.4, ease: easePop },
              scale: { duration: 0.4, ease: easePop },
              opacity: { duration: 0.24, ease: easeEnter },
            },
          }}
          exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16, ease: easeExit } }}
        >
          <div
            className="win-bar"
            title="拖动标题栏移动窗口，双击复位；键盘：Alt + 方向键"
            onPointerDown={drag.onPointerDown}
            onDoubleClick={drag.reset}
          >
            <span className="name">comments.log</span>
            <button type="button" className="win-ctl" aria-label="收起评论" onClick={close} />
          </div>
          <div className="win-body comments-float-body">
            <Comments entryId={target.entryId} />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
