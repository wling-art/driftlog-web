# driftlog-web

Bun workspace: `apps/blog` (TanStack Start, SSR, boring-ui design) and `apps/admin` (Vite SPA, shadcn/ui, Vercel-console style). `core/` is a git submodule (the API and shared packages); its packages are part of this workspace, so Eden types come straight from the server source.

## Commands

```bash
bun run dev            # API (from core/) :3900 + blog :5173 + admin :5174
bun run typecheck      # tsgo per app
bun run lint && bun run fmt
E2E_EMAIL=… E2E_PASSWORD=… bun run test   # Playwright; admin cases skip without an owner account
```

- Vite must run under Bun: scripts use `bun --bun vite`. Plain `vite` runs on Node and breaks.
- **Dev points at the real database** (`driftlog` on the home server). E2E creates posts, comments and an owner account, so **never run it against the normal dev servers**. Run an isolated stack on the local empty DB and Redis db 1, then point the tests at it:
  ```bash
  # API :3901 (WORKER=off, DATABASE_URL=postgres://postgres@localhost:5432/driftlog, REDIS_URL=redis://localhost:6379/1,
  #   ADMIN_URL=http://localhost:5175, BLOG_URL=http://localhost:5176), admin :5175 and blog :5176 with VITE_API_URL=http://localhost:3901
  E2E_BLOG=http://localhost:5176 E2E_ADMIN=http://localhost:5175 E2E_EMAIL=… E2E_PASSWORD=… bun run test
  ```
  Afterwards drop and re-migrate the local DB and `redis-cli -n 1 flushdb`. Comments are rate-limited to 5 per minute per IP.
- Visual checks: take Playwright screenshots (the Chrome extension isn't connected on this machine). Check light, dark, and 390px wide.

## Blog layout model (don't regress these)

- **Wide screens (≥ 761px)**: the page never scrolls (`html, body { overflow: clip }`, not `hidden`, because anchor jumps still scroll `hidden`). `.desktop-area` is a size container; each window is capped to it and scrolls *inside* `.win-body`. The taskbar and desktop icons never move.
- **The taskbar lives in the root layout** (`AppShell` in `__root.tsx`), rendered once. Routes render only `SiteShell` (their desktop area: icons + windows), keyed by pathname. If a route renders its own taskbar again, it remounts on every navigation and the tab rise/drop transitions stop playing.
- **Page transitions**: no browser View Transitions. `SiteShell` keys the window column by pathname so it remounts and plays the CSS `page-in` animation. For prev/next, call `markDirection("forward" | "back")` before navigating (`lib/keys.ts`).
- **Site name, description and owner info come from the API** (`GET /site`, edited in admin 设置), loaded once by the root route: use `useSite()` in components and `siteOf(matches)` in `head()`. Don't reintroduce `VITE_SITE_NAME`-style env vars.
- **Old Shiro URLs keep working**: `/posts/:category/:slug` 301s to `/posts/:slug`; note slugs are the old numeric `nid`; entry loaders (`loadEntry`) 301 renamed slugs via `/entries/resolve`.
- **Secondary things live in the shell**: comments are minimized to the taskbar and open as a floating window (`comments-dock.tsx`); prev/next are title-bar `‹ ›` controls; lists are a year-grouped archive with no pagination.
- Reading width is `--measure: 40em` (≈ 40 CJK characters, the WCAG 1.4.8 limit), and the reading window hugs it. Don't put a `max-width: var(--measure)` on smaller-font children: `em` follows their own font size.
- Desktop icons sit in fixed 76 × 82px cells; pixel-font labels need integer line heights (16px).
- **Windows** are resizable (bottom-right grip) and all closable; closed ones sit in the taskbar (`ClosedTasks` portals into `#tb-closed`) until the page changes. Resizing and closing never move other windows: a resized window compensates with `margin-bottom`, and on wide screens a closed window keeps its slot (`data-closed` + `visibility: hidden`), so don't switch back to the `hidden` attribute.
- **Accounts**: like mx-space, readers sign in only with GitHub / Google (start menu → `components/account.tsx`, Better Auth client in `lib/auth.ts`); the buttons come from `site.oauth`, i.e. whichever providers the server has credentials for. Signed-in comments use the account's name, email and avatar. Email sign-in is only for the owner, in the admin; the admin signs readers out with a message.
- **Diagrams**: Mermaid and Excalidraw are drawn in the browser (`components/article.tsx`), loading the library only when a page has one. Excalidraw blocks are ```` ```excalidraw ```` with clipboard JSON; older stored HTML and translations have them as Shiki code blocks, recognised by content.
- Forms: once a field shows an error, re-validate on change (otherwise blur removes the error line, the button jumps, and the click misses).

## Traps

- **Cloudflare Workers build**: `vite build` uses Nitro's `cloudflare_module` preset (dev stays a Node server). OG images use `@cf-wasm/og` (wasm, works in workerd and Bun); the font is read through the `ASSETS` binding (`globalThis.__env__`), because a Worker can't fetch its own domain. Mermaid and Excalidraw are aliased to an empty mock for the server bundle, or the Worker exceeds 3 MB. `wrangler.json` must stay plain JSON (Nitro's parser rejects jsonc trailing commas). Deploy: `bun --filter @driftlog/blog deploy` with `VITE_SITE_URL` / `VITE_API_URL` in `apps/blog/.env.production.local`.
- **TanStack `Link` sets `aria-current` from the URL immediately**, before the new route's data loads. In tests, wait for new content, not for `aria-current`.
- **shadcn `Table`** wraps the table in `overflow-x-auto`, which breaks `position: sticky` on the header (it shifted the header over the first row). Don't make that header sticky.
- `useArrowNav` keeps targets in a ref updated in `useLayoutEffect`. Don't compare targets with `JSON.stringify`: `search` is often a function, which it drops.
- Anything read from `localStorage` or the clock must be SSR-safe (`useSyncExternalStore` with a `null` server snapshot).

## Design sources

- Blog: the boring-ui skill (`~/.claude/skills/boring-ui`); `src/styles/{tokens,desktop,patterns}.css` and `src/components/boring` are vendored copies (the content widgets `.icon-link`, `.archive`, `.folder-intro`, `.lang-switch`, `.copyright`, `.article-end` live in `patterns.css`, not `app.css`). `boring/desktop.tsx` differs from the skill only in using the router's `Link` in `Taskbar` and rendering closed windows through its own portal; `toc.tsx` and `start-menu.tsx` are the blog's versions of the skill's `Toc*`/`StartMenu`. Keep them in sync with the skill, and record design changes in the skill's `CHANGELOG.md`.
- Admin: its own theme in `apps/admin/src/index.css` (Geist, neutral grays, blue only for links and focus). Content area is full width, with multiple columns on wide screens.

## Deploy (Cloudflare)

`bun run deploy` runs `wrangler deploy` in `apps/*`, all in account MrlingXD (`account_id` in each `wrangler.json`):

- `apps/blog` → Worker on `ling.crashvibe.cn` (see the Workers build trap above).
- `apps/admin` → static assets Worker (SPA fallback) on `ling-admin.crashvibe.cn`.
- `apps/api-proxy` → Worker on `ling-api.crashvibe.cn`; forwards to the API through a Workers VPC service bound to a Cloudflare Tunnel (`cloudflared --protocol http2` on the home server, `/opt/driftlog/compose.yaml`: api, valkey, meilisearch, cloudflared). The wrangler OAuth token has no DNS scope, so this avoids needing a CNAME for the API.
- Build-time URLs go in `apps/{blog,admin}/.env.production.local` (git-ignored): `VITE_API_URL`, `VITE_SITE_URL` (blog) / `VITE_BLOG_URL` (admin).
- A Worker custom domain can't be created over an existing DNS record: delete the old CNAME first.
