# driftlog-web

Driftlog 的博客前台和管理后台。服务端在 [driftlog-core](../core)（以 git submodule 的形式放在 `core/`）。结构参考 [Shiro](https://github.com/Innei/Shiro)。

```
apps/blog    博客前台：TanStack Start（SSR）+ boring-ui「低饱桌面」
apps/admin   管理后台：Vite SPA + shadcn/ui，Vercel 控制台风格
core/        submodule → driftlog-core（Eden 客户端、Zod schema、Markdown 管线都从这里来）
e2e/         Playwright
```

`core/` 里的包直接列在本仓库的 Bun workspaces 里，所以 Eden Treaty 的类型直接来自服务端源码，改了接口两边一起类型检查。

## 本地开发

```bash
git submodule update --init
bun install
cp apps/blog/.env.example apps/blog/.env
cp apps/admin/.env.example apps/admin/.env
# 先按 core/README.md 把 API 跑起来（默认 :3900）
bun run dev            # 博客 :5173 · 后台 :5174
```

## 检查

```bash
bun run typecheck      # tsgo
bun run lint           # oxlint
bun run fmt            # oxfmt
E2E_EMAIL=… E2E_PASSWORD=… bun run test   # Playwright；不给站长账号就跳过后台用例
```

## 博客前台

- 设计：boring-ui 的 tokens.css / desktop.css 原样放在 `apps/blog/src/styles`，桌面组件在 `components/boring`，换过皮的 shadcn 在 `components/ui`。文章页是「阅读」场景，左边文件夹列就是目录；分类页的文件夹就是分类。
- 数据：TanStack Router loader + TanStack Query（SSR 时预取、客户端复用）。
- SEO：每页 head、JSON-LD、`/sitemap.xml`、`/feed.xml`（RSS）、`/atom.xml`、`/og/:type/:slug`（Satori + resvg，像素字用 `public/fonts` 里的 Fusion Pixel TTF，SIL OFL 1.1）。
- 实时：WebSocket 收在线人数、新评论、新文章。
- 搜索：⌘K 面板（Radix Dialog + cmdk），后端是 Meilisearch。
- 动效：Motion（新评论出现）+ View Transitions（路由切换），曲线都是 tokens 里那四条。没加 Lenis。
- 部署：Vercel。`vercel.json` 的 `bunVersion` 让函数跑在 Bun 上；Nitro 的 routeRules 给页面、OG 图、字体设了 CDN 缓存头。

## 管理后台

- 概览（Recharts）、文章 / 手记 / 页面（TanStack Table v9）、编辑器、分类（dnd-kit 拖拽 + 上移 / 下移按钮）、评论审核、文件（孤儿文件清理）、设置（备份、Passkey）。
- 编辑器：CodeMirror 6；宽屏三栏「源码 | 预览 | 属性」，中屏两栏，预览用和博客同一条 Markdown 管线。粘贴 / 拖进图片直接上传。⌘S 保存。
- 登录：Better Auth（邮箱密码、Passkey、GitHub / Google）。
- 部署：Vercel 静态托管，`vercel.json` 把所有路径改写到 `index.html`。

## 部署到 GitHub 之后

submodule 现在指向本地的 `../core`。推到远端后改成仓库地址：

```bash
git submodule set-url core https://github.com/<你>/driftlog-core.git
```

## 许可证

双重授权：开源部分采用 [AGPL-3.0](LICENSE)；需要闭源或商用授权时见 [商业授权](COMMERCIAL.md)。
