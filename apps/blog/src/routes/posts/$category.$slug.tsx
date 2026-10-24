import { createFileRoute, redirect } from "@tanstack/react-router"

// 旧站地址 /posts/分类/slug 301 到 /posts/slug
export const Route = createFileRoute("/posts/$category/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/posts/$slug", params: { slug: params.slug }, statusCode: 301 })
  },
})
