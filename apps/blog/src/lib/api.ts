import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { createClient, unwrap } from "@driftlog/client"
import { site, type EntryType } from "./site"

// 前台和后台共用 core 里的 Eden Treaty 客户端，类型直接来自服务端
export const api = createClient(site.api)

export const entriesQuery = (q: { type: EntryType; page?: number; category?: string; tag?: string }) =>
  queryOptions({
    queryKey: ["entries", q],
    queryFn: () => unwrap(api.entries.get({ query: { size: 10, ...q } })),
  })

export const entryQuery = (type: EntryType, slug: string, lang?: string) =>
  queryOptions({
    queryKey: ["entry", type, slug, lang],
    queryFn: () => unwrap(api.entries.slug({ slug }).get({ query: { type, lang } })),
  })

export const indexQuery = (
  type: EntryType,
  filter: { category?: string; tag?: string; topic?: string } = {},
) =>
  queryOptions({
    queryKey: ["index", type, filter],
    queryFn: () => unwrap(api.entries.index.get({ query: { type, ...filter } })),
  })

// 站点设置（站名、简介、站长资料）：根路由加载时就取好，组件里用 useSite() 读
export const siteQuery = () =>
  queryOptions({ queryKey: ["site"], queryFn: () => unwrap(api.site.get()), staleTime: 600_000 })
export const topicsQuery = () =>
  queryOptions({ queryKey: ["topics"], queryFn: () => unwrap(api.topics.get()), staleTime: 600_000 })
export const saysQuery = () =>
  queryOptions({ queryKey: ["says"], queryFn: () => unwrap(api.says.get()), staleTime: 600_000 })
export const thoughtsQuery = () =>
  queryOptions({ queryKey: ["thoughts"], queryFn: () => unwrap(api.thoughts.get()) })
export const linksQuery = () =>
  queryOptions({ queryKey: ["links"], queryFn: () => unwrap(api.links.get()), staleTime: 600_000 })
export const projectsQuery = () =>
  queryOptions({ queryKey: ["projects"], queryFn: () => unwrap(api.projects.get()), staleTime: 600_000 })
/** 站点设置（根路由已经取好，不会再等） */
export const useSite = () => useSuspenseQuery(siteQuery()).data
export type SiteSettings = Awaited<ReturnType<ReturnType<typeof siteQuery>["queryFn"] & {}>>

export const categoriesQuery = () =>
  queryOptions({ queryKey: ["categories"], queryFn: () => unwrap(api.categories.get()), staleTime: 600_000 })

export const commentsQuery = (entryId: number) =>
  queryOptions({
    queryKey: ["comments", entryId],
    queryFn: () => unwrap(api.comments.get({ query: { entryId } })),
  })

export type Entry = Awaited<ReturnType<ReturnType<typeof entryQuery>["queryFn"] & {}>>
export type EntryCard = Awaited<ReturnType<ReturnType<typeof entriesQuery>["queryFn"] & {}>>["items"][number]
export type Comment = Awaited<ReturnType<ReturnType<typeof commentsQuery>["queryFn"] & {}>>[number]

/** 404 走 notFound()，别的错误交给错误边界 */
export const isNotFound = (e: unknown) => (e as { status?: number })?.status === 404
