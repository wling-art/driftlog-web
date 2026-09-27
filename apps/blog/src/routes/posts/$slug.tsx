import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { EntryPage, entryHead, loadEntry, siteOf } from "@/components/entry-page"

export const Route = createFileRoute("/posts/$slug")({
  validateSearch: z.object({ lang: z.string().optional() }),
  loaderDeps: ({ search }) => ({ lang: search.lang }),
  loader: ({ context, params, deps }) => loadEntry(context.queryClient, "post", params.slug, deps.lang),
  head: ({ loaderData, matches }) => entryHead(loaderData, siteOf(matches)),
  component: () => <EntryPage entry={Route.useLoaderData()} />,
})
