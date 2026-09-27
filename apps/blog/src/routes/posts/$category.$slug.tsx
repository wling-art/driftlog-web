import { createFileRoute, redirect } from "@tanstack/react-router"

// 旧站（Shiro）的文章地址是 /posts/分类/slug：直接 301 到 /posts/slug
export const Route = createFileRoute("/posts/$category/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/posts/$slug", params: { slug: params.slug }, statusCode: 301 })
  },
})
