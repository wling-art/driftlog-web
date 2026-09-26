import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { EntryPage, entryHead } from "@/components/entry-page"
import { entryQuery, isNotFound } from "@/lib/api"

export const Route = createFileRoute("/posts/$slug")({
  validateSearch: z.object({ lang: z.string().optional() }),
  loaderDeps: ({ search }) => ({ lang: search.lang }),
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(entryQuery("post", params.slug, deps.lang)).catch((e) => {
      throw isNotFound(e) ? notFound() : e
    }),
  head: ({ loaderData }) => entryHead(loaderData),
  component: () => <EntryPage entry={Route.useLoaderData()} />,
})
