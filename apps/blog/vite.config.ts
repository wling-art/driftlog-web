import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { nitro } from "nitro/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173 },
  // resvg 是原生模块、satori 带 wasm：不预构建、SSR 时不打包，让 Nitro 按 node_modules 原样带上
  optimizeDeps: { exclude: ["@resvg/resvg-js", "satori"] },
  ssr: { external: ["@resvg/resvg-js", "satori"] },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // 本地是 node-server；在 Vercel 上自动切到 vercel 预设，vercel.json 的 bunVersion 让函数跑在 Bun 上
    nitro({
      // satori 运行时要读自带的 hb.wasm / yoga.wasm，打包会丢；按 node_modules 原样拷过去
      traceDeps: ["satori*", "harfbuzzjs*", "@resvg/resvg-js"], // 带 * = 整个包原样拷贝
      routeRules: {
        // CDN 缓存：页面短缓存 + 后台刷新；OG 图、订阅源缓存更久
        "/**": { headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600" } },
        "/og/**": {
          headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
        },
        "/fonts/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
      },
    }),
    viteReact(),
  ],
})
