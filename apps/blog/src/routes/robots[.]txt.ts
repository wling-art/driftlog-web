import { createFileRoute } from "@tanstack/react-router"
import { site } from "@/lib/site"

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(`User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    },
  },
})
