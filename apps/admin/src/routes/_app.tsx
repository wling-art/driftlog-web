import { Link, Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  ExternalLink,
  FileText,
  FolderTree,
  Image,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  NotebookPen,
  Settings,
  StickyNote,
  Sun,
  Boxes,
  Library,
  Link2,
  Quote,
  Zap,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { api, auth, BLOG_URL, unwrap } from "@/lib/api"
import { useTheme } from "@/lib/theme"

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => unwrap(api.admin.me.get()),
  staleTime: 300_000,
})
export const statsQuery = queryOptions({ queryKey: ["stats"], queryFn: () => unwrap(api.admin.stats.get()) })

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery)
    } catch {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
  },
  component: Layout,
})

const content = [
  { to: "/entries", search: { type: "post" as const }, label: "文章", icon: FileText },
  { to: "/entries", search: { type: "note" as const }, label: "手记", icon: NotebookPen },
  { to: "/entries", search: { type: "page" as const }, label: "页面", icon: StickyNote },
]

// mx-space 带过来的栏目
const extras = [
  { to: "/topics", label: "手记专栏", icon: Library },
  { to: "/thoughts", label: "动态", icon: Zap },
  { to: "/says", label: "一言", icon: Quote },
  { to: "/projects", label: "项目", icon: Boxes },
] as const

function Layout() {
  const { data: me } = useSuspenseQuery(meQuery)
  const { data: stats } = useQuery(statsQuery)
  const { data: links } = useQuery({
    queryKey: ["admin-links-pending"],
    queryFn: () => unwrap(api.admin.links.get()),
    staleTime: 60_000,
  })
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/">
                  <img src="/favicon.svg" alt="" className="size-7 rounded-md" />
                  <span className="font-semibold">Driftlog</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="概览">
                  <Link to="/" activeOptions={{ exact: true }} activeProps={{ "data-active": true }}>
                    <LayoutDashboard /> 概览
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>内容</SidebarGroupLabel>
            <SidebarMenu>
              {content.map((c) => (
                <SidebarMenuItem key={c.label}>
                  <SidebarMenuButton asChild tooltip={c.label}>
                    <Link
                      to={c.to}
                      search={c.search}
                      activeOptions={{ includeSearch: true }}
                      activeProps={{ "data-active": true }}
                    >
                      <c.icon /> {c.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="分类">
                  <Link to="/categories" activeProps={{ "data-active": true }}>
                    <FolderTree /> 分类
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>栏目</SidebarGroupLabel>
            <SidebarMenu>
              {extras.map((c) => (
                <SidebarMenuItem key={c.to}>
                  <SidebarMenuButton asChild tooltip={c.label}>
                    <Link to={c.to} activeProps={{ "data-active": true }}>
                      <c.icon /> {c.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>互动与资源</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="友链">
                  <Link to="/links" activeProps={{ "data-active": true }}>
                    <Link2 /> 友链
                  </Link>
                </SidebarMenuButton>
                {!!links?.pending && <SidebarMenuBadge className="tabular">{links.pending}</SidebarMenuBadge>}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="评论">
                  <Link to="/comments" activeProps={{ "data-active": true }}>
                    <MessageSquare /> 评论
                  </Link>
                </SidebarMenuButton>
                {!!stats?.pendingComments && (
                  <SidebarMenuBadge className="tabular">{stats.pendingComments}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="文件">
                  <Link to="/files" activeProps={{ "data-active": true }}>
                    <Image /> 文件
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="设置">
                  <Link to="/settings" activeProps={{ "data-active": true }}>
                    <Settings /> 设置
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="打开博客">
                <a href={BLOG_URL} target="_blank" rel="noreferrer">
                  <ExternalLink /> 打开博客
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="退出登录"
                onClick={async () => {
                  await auth.signOut()
                  navigate({ to: "/login" })
                }}
              >
                <LogOut /> <span className="truncate">{me.email}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
          <SidebarTrigger />
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "切到亮色" : "切到暗色"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </header>
        <div className="w-full min-w-0 flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** 每页顶部：标题、说明、右侧操作。内容区铺满宽度 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
