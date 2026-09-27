import type { ReactNode } from "react"
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SearchPanel } from "@/components/search"
import { ErrorWindow, NotFound } from "@/components/site"
import { MotionConfig } from "motion/react"
import { useRealtime } from "@/lib/realtime"
import { site } from "@/lib/site"
import css from "@/styles/app.css?url"

// 主题在首帧前就定下来，免得先闪一下亮色（use-theme 用的同一个 key）
const themeScript = `try{var t=localStorage.getItem("boring-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: site.name },
      { name: "description", content: site.description },
      { property: "og:site_name", content: site.name },
      { name: "theme-color", content: "#cfd3d7", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#1c1e1f", media: "(prefers-color-scheme: dark)" },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "alternate", type: "application/rss+xml", title: site.name, href: "/feed.xml" },
      { rel: "alternate", type: "application/atom+xml", title: site.name, href: "/atom.xml" },
    ],
    scripts: [{ children: themeScript }],
  }),
  component: () => (
    <Document>
      <Outlet />
    </Document>
  ),
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <Document>
      <ErrorWindow error={error as Error} reset={reset} />
    </Document>
  ),
})

function Document({ children }: { children: ReactNode }) {
  useRealtime()
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* 系统开了「减少动效」时，Motion 的动画也跟着关 */}
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={400}>
            {children}
            <SearchPanel />
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
        <Scripts />
      </body>
    </html>
  )
}
