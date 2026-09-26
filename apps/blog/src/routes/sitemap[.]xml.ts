import { createFileRoute } from "@tanstack/react-router"
import { sitemap } from "@/server/feed"

export const Route = createFileRoute("/sitemap.xml")({ server: { handlers: { GET: () => sitemap() } } })
