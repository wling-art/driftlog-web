import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/*
 * Boring UI 状态标签：像素字 + 细线框；状态色永远配图标或文字，不用桌面青（它只给能点的东西）
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-1.5 pixel-1 leading-none whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-input text-foreground",
        secondary: "border-transparent bg-muted text-foreground",
        success: "border-current text-success",
        warning: "border-current text-warning",
        destructive: "border-current text-destructive",
        outline: "border-input text-foreground",
        ghost: "border-transparent text-muted-foreground",
        link: "border-transparent text-primary underline underline-offset-3",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
