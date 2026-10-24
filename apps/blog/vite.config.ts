import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { nitro } from "nitro/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"

// 只在浏览器里动态加载的大库，服务端构建换成空模块
const clientOnly = ["mermaid", "@excalidraw/excalidraw"]

export default defineConfig(({ command }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173 },
  optimizeDeps: { exclude: ["@cf-wasm/og"] },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // 构建产物是 Cloudflare Worker（wrangler.json 合并进生成的配置）；开发时仍是 Node 服务
    nitro({
      preset: command === "build" ? "cloudflare_module" : undefined,
      alias: Object.fromEntries(clientOnly.map((m) => [m, "unenv/mock/proxy"])),
      routeRules: {
        // 缓存：页面 60 秒，OG 图一天，字体永久
        "/**": { headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600" } },
        "/og/**": {
          headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
        },
        "/fonts/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
      },
    }),
    viteReact(),
  ],
}))
