import type { ReactNode } from "react"
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SearchPanel } from "@/components/search"
import { AppShell, ErrorWindow, NotFound } from "@/components/site"
import { MotionConfig } from "motion/react"
import { useRealtime } from "@/lib/realtime"
import { siteQuery } from "@/lib/api"
import { site } from "@/lib/site"
import css from "@/styles/app.css?url"

// 首帧前套用记住的主题（key 同 use-theme）
const themeScript = `try{var t=localStorage.getItem("boring-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteQuery()),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: loaderData?.title },
      { name: "description", content: loaderData?.description },
      { name: "keywords", content: loaderData?.keywords.join(",") },
      { property: "og:site_name", content: loaderData?.title },
      { name: "theme-color", content: "#cfd3d7", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#1c1e1f", media: "(prefers-color-scheme: dark)" },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "alternate", type: "application/rss+xml", title: loaderData?.title, href: "/feed.xml" },
      { rel: "alternate", type: "application/atom+xml", title: loaderData?.title, href: "/atom.xml" },
    ],
    scripts: [
      { children: themeScript },
      ...(site.umami ? [{ src: site.umami.src, defer: true, "data-website-id": site.umami.id }] : []),
    ],
  }),
  component: () => (
    <Document>
      <AppShell>
        <Outlet />
      </AppShell>
    </Document>
  ),
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <Document>
      <AppShell>
        <ErrorWindow error={error as Error} reset={reset} />
      </AppShell>
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
