import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/*
 * Boring UI 按钮（改自 shadcn/ui）
 * - 尺寸只有两档，而且跟着场景走：default 用 --control-h / --ui-px（通用、阅读、工具是 32px，触屏、展示和触屏设备是 48px），
 *   sm 强制小号，lg 强制大号。字号、高度、内边距、最小宽度成套变化。
 * - 能按 = 灰线框 + 一点投影；主按钮 = 桌面青；指上去反白（墨底 + 屏幕色字）；按下右下移 1px、影子消失。
 * - 像素字不加粗。
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border font-pixel font-normal whitespace-nowrap select-none shadow-xs " +
    "transition-colors duration-(--duration) ease-enter " +
    "active:not-aria-[haspopup]:translate-x-px active:not-aria-[haspopup]:translate-y-px active:shadow-none " +
    "disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1em]",
  {
    variants: {
      variant: {
        /* 主按钮：每屏只有一个 */
        default:
          "border-primary bg-primary text-primary-foreground hover:border-(--accent-hover) hover:bg-(--accent-hover)",
        primary:
          "border-primary bg-primary text-primary-foreground hover:border-(--accent-hover) hover:bg-(--accent-hover)",
        /* 次按钮：灰框能按 */
        outline:
          "border-input bg-secondary text-foreground hover:border-foreground hover:bg-foreground hover:text-background aria-expanded:bg-foreground aria-expanded:text-background",
        secondary:
          "border-input bg-secondary text-foreground hover:border-foreground hover:bg-foreground hover:text-background",
        /* 幽灵按钮：没有框，只在指上去时反白（工具栏、菜单触发器） */
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-foreground hover:text-background aria-expanded:bg-foreground aria-expanded:text-background",
        /* 危险：平时是次按钮样式，确认那一步才用 destructive-solid */
        destructive:
          "border-destructive bg-secondary text-destructive hover:bg-destructive hover:text-secondary",
        "destructive-solid": "border-destructive bg-destructive text-secondary hover:opacity-90",
        /* 文字按钮：青色 + 下划线，不设最小宽度，但和同一行按钮一样高 */
        link: "min-w-0! border-transparent bg-transparent px-[calc(var(--control-pad)/2)]! shadow-none text-primary underline underline-offset-3 hover:bg-foreground hover:text-background hover:no-underline",
      },
      size: {
        default: "h-(--control-h) min-w-(--control-min-w) px-(--control-pad) text-(length:--ui-px)",
        sm: "h-8 min-w-16 px-3 pixel-1",
        lg: "h-12 min-w-28 px-5 pixel-2",
        icon: "size-(--control-h) text-(length:--ui-px)",
        "icon-sm": "size-8 pixel-1",
        "icon-lg": "size-12 pixel-2",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "outline",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
