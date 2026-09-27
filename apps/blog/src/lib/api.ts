import { queryOptions } from "@tanstack/react-query"
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

export const indexQuery = (type: EntryType) =>
  queryOptions({
    queryKey: ["index", type],
    queryFn: () => unwrap(api.entries.index.get({ query: { type } })),
    staleTime: 600_000,
  })

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
