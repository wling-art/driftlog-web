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
- E2E creates posts and comments every run, and comments are rate-limited to 5 per minute per IP. Running the suite several times in a row can fail on the comment step; wait a minute.
- Visual checks: take Playwright screenshots (the Chrome extension isn't connected on this machine). Check light, dark, and 390px wide.

## Blog layout model (don't regress these)

- **Wide screens (≥ 761px)**: the page never scrolls (`html, body { overflow: clip }`, not `hidden`, because anchor jumps still scroll `hidden`). `.desktop-area` is a size container; each window is capped to it and scrolls *inside* `.win-body`. The taskbar and desktop icons never move.
- **Page transitions**: no browser View Transitions. `SiteShell` keys the window column by pathname so it remounts and plays the CSS `page-in` animation. For prev/next, call `markDirection("forward" | "back")` before navigating (`lib/keys.ts`).
- **Secondary things live in the shell**: comments are minimized to the taskbar and open as a floating window (`comments-dock.tsx`); prev/next are title-bar `‹ ›` controls; lists are a year-grouped archive with no pagination.
- Reading width is `--measure: 40em` (≈ 40 CJK characters, the WCAG 1.4.8 limit), and the reading window hugs it. Don't put a `max-width: var(--measure)` on smaller-font children: `em` follows their own font size.
- Desktop icons sit in fixed 76 × 82px cells; pixel-font labels need integer line heights (16px).
- Forms: once a field shows an error, re-validate on change (otherwise blur removes the error line, the button jumps, and the click misses).

## Traps

- **OG images**: `satori` and `@resvg/resvg-js` are SSR externals, and Nitro must copy them whole: `traceDeps: ["satori*", "harfbuzzjs*", …]` in `apps/blog/vite.config.ts`. Without the `*`, `hb.wasm` is missing in production.
- **TanStack `Link` sets `aria-current` from the URL immediately**, before the new route's data loads. In tests, wait for new content, not for `aria-current`.
- **shadcn `Table`** wraps the table in `overflow-x-auto`, which breaks `position: sticky` on the header (it shifted the header over the first row). Don't make that header sticky.
- `useArrowNav` keeps targets in a ref updated in `useLayoutEffect`. Don't compare targets with `JSON.stringify`: `search` is often a function, which it drops.
- Anything read from `localStorage` or the clock must be SSR-safe (`useSyncExternalStore` with a `null` server snapshot).

## Design sources

- Blog: the boring-ui skill (`~/.claude/skills/boring-ui`); `src/styles/{tokens,desktop}.css` and `src/components/boring` are vendored copies. Keep them in sync with the skill, and record design changes in the skill's `CHANGELOG.md`.
- Admin: its own theme in `apps/admin/src/index.css` (Geist, neutral grays, blue only for links and focus). Content area is full width, with multiple columns on wide screens.
