import { createFileRoute } from "@tanstack/react-router"
import { unwrap } from "@driftlog/client"
import { api } from "@/lib/api"
import { ogImage } from "@/server/og"

export const Route = createFileRoute("/og/$type/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        // 用有缓存的订阅源数据，不走详情接口（详情会加阅读数）
        const all = await unwrap(api.entries.feed.get())
        const e = all.find((x) => x.type === params.type && x.slug === params.slug)
        if (!e) return new Response("not found", { status: 404 })
        const png = await ogImage(new URL(request.url).origin, e, (await unwrap(api.site.get())).title)
        return new Response(png, { headers: { "content-type": "image/png" } })
      },
    },
  },
})
