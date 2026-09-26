import { createFileRoute } from "@tanstack/react-router"
import { atom } from "@/server/feed"

export const Route = createFileRoute("/atom.xml")({ server: { handlers: { GET: () => atom() } } })
