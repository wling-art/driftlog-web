import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

/** 执行异步任务的按钮：超过 --indicator-delay 才显示加载圆点，加载时宽度不变 */
export function TaskButton({
  task,
  doneText,
  onDone,
  children,
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "asChild"> & {
  task: () => Promise<unknown>
  doneText?: React.ReactNode
  onDone?: () => void
}) {
  const [state, setState] = React.useState<"idle" | "busy" | "slow" | "done">("idle")
  const [width, setWidth] = React.useState<number>()

  const run = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (state === "busy" || state === "slow") return
    setWidth(e.currentTarget.offsetWidth)
    setState("busy")
    const delay =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--indicator-delay")) || 400
    const slow = setTimeout(() => setState("slow"), delay)
    try {
      await task()
      onDone?.()
      setState(doneText ? "done" : "idle")
      if (doneText) setTimeout(() => setState("idle"), 2000)
    } catch {
      setState("idle")
    } finally {
      clearTimeout(slow)
    }
  }

  React.useEffect(() => {
    if (state === "idle") setWidth(undefined)
  }, [state])

  return (
    <Button
      aria-busy={state === "busy" || state === "slow" || undefined}
      onClick={run}
      style={{ minWidth: width }}
      className={cn(state === "busy" && "cursor-progress", className)}
      {...props}
    >
      <span className={cn(state === "slow" && "invisible")}>{state === "done" ? doneText : children}</span>
      {state === "slow" && <span aria-hidden="true" className="spinner" />}
    </Button>
  )
}
