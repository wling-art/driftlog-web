import { createFileRoute } from "@tanstack/react-router"
import { rss } from "@/server/feed"

export const Route = createFileRoute("/feed.xml")({ server: { handlers: { GET: () => rss() } } })
