import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { createClient, unwrap } from "@driftlog/client"
import { site, type EntryType } from "./site"

// core 里的 Eden Treaty 客户端，类型来自服务端
export const api = createClient(site.api)

/** 某类最近的 10 篇和总数 */
export const entriesQuery = (type: EntryType) =>
  queryOptions({
    queryKey: ["entries", type],
    queryFn: () => unwrap(api.entries.get({ query: { type, size: 10 } })),
  })

export const entryQuery = (type: EntryType, slug: string, lang?: string) =>
  queryOptions({
    queryKey: ["entry", type, slug, lang],
    queryFn: () => unwrap(api.entries.slug({ slug }).get({ query: { type, lang } })),
  })

/** 归档：某类的全部条目，可按分类、标签、专栏筛 */
export const indexQuery = (
  type: EntryType,
  filter: { category?: string; tag?: string; topic?: string } = {},
) =>
  queryOptions({
    queryKey: ["index", type, filter],
    queryFn: () => unwrap(api.entries.index.get({ query: { type, ...filter } })),
  })

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
/** 站点设置（根路由已加载） */
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

export const isNotFound = (e: unknown) => (e as { status?: number })?.status === 404
