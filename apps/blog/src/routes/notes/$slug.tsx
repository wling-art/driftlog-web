import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { EntryPage, entryHead, loadEntry } from "@/components/entry-page"
import { siteOf } from "@/lib/site"

export const Route = createFileRoute("/notes/$slug")({
  validateSearch: z.object({ lang: z.string().optional() }),
  loaderDeps: ({ search }) => ({ lang: search.lang }),
  loader: ({ context, params, deps }) => loadEntry(context.queryClient, "note", params.slug, deps.lang),
  head: ({ loaderData, matches }) => entryHead(loaderData, siteOf(matches)),
  component: () => <EntryPage entry={Route.useLoaderData()} />,
})
