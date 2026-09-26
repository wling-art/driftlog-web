import { Toaster as Sonner, type ToasterProps } from "sonner"

/*
 * Boring UI 轻提示（改自 shadcn/ui）
 * - 是一个带最大一档投影的小窗口，像素字；位置在底部居中、任务栏上方
 * - 成功自动消失；能撤销就给「撤销」按钮（toast(msg, { action: { label: "撤销", onClick } })），不弹确认框
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: 76 }}
      mobileOffset={{ bottom: 68 }}
      gap={8}
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-lg border border-border bg-surface py-1.5 pr-1.5 pl-3.5 pixel-1 leading-normal text-foreground shadow-lg",
          title: "font-normal",
          description: "font-sans text-sm text-muted-foreground",
          actionButton:
            "ml-auto inline-flex h-8 min-w-16 shrink-0 items-center justify-center rounded-md border border-input bg-secondary px-3 pixel-1 shadow-xs hover:border-foreground hover:bg-foreground hover:text-background active:translate-x-px active:translate-y-px active:shadow-none",
          cancelButton: "ml-auto h-8 px-2 pixel-1 text-primary underline underline-offset-3",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-warning",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
