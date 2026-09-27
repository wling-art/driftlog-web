import { createRouter } from "@tanstack/react-router"
import { QueryClient } from "@tanstack/react-query"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { routeTree } from "./routeTree.gen"
import { NotFound } from "./components/site"

export function getRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // 宽屏下整页不滚，滚的是桌面区域：换页时把它滚回顶部
    scrollToTopSelectors: [".desktop-area"],
    defaultPreload: "intent",
    defaultViewTransition: true, // 路由切换用 View Transitions，曲线在 app.css
    defaultNotFoundComponent: NotFound,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
