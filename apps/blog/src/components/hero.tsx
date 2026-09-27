import { Link } from "@tanstack/react-router"
import { Mail } from "lucide-react"
import { Window } from "@/components/boring"
import type { SiteSettings } from "@/lib/api"

/*
 * 首页头部（参考 Shiro 的 Hero，换成低饱桌面的样子）：
 *   左：48px 像素字「你好，我是 xx」逐字升起 → 站名 · 简介 → 介绍拆成的标签 → 社交账号按钮
 *   右：方形相框里的头像（和窗口一样的细线 + 小圆角，不用圆形）
 *   底：一言，两行为止，悬停看全文
 * 窗口窄了就头像在上、整体居中（@container）。
 * 不用「展示」场景：它把留白放大 1.5 倍，首页一屏里就放不下下面的文章了。
 */

// 品牌图标：Simple Icons（CC0）的路径，只取用得到的几个，不为它装一个包
const brand = (d: string) => () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
)
const paths = {
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  telegram:
    "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  bilibili:
    "M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z",
}

// 社交账号 → 链接、图标、名字。按钮只放图标（这几个标志一眼认得出），名字给读屏和悬停提示
const socials: Record<string, { label: string; Icon: () => React.ReactNode; href: (v: string) => string }> = {
  github: { label: "GitHub", Icon: brand(paths.github), href: (v) => `https://github.com/${v}` },
  twitter: { label: "X", Icon: brand(paths.x), href: (v) => `https://x.com/${v}` },
  telegram: { label: "Telegram", Icon: brand(paths.telegram), href: (v) => `https://t.me/${v}` },
  bilibili: {
    label: "哔哩哔哩",
    Icon: brand(paths.bilibili),
    href: (v) => `https://space.bilibili.com/${v}`,
  },
  email: { label: "邮件", Icon: () => <Mail aria-hidden="true" />, href: (v) => `mailto:${v}` },
}

type Say = { text: string; author: string | null; source: string | null } | null

export function Hero({ info, say }: { info: SiteSettings; say: Say }) {
  const greeting = `你好，我是 ${info.owner.name}`
  // 介绍按「｜」拆成标签；开头就是名字的那一段不要（标题里已经有了）
  const tags = info.owner.introduce
    .split(/[｜|]/)
    .map((t) => t.trim())
    .filter((t) => t && t !== info.owner.name)
  const links = Object.entries(info.owner.socials).filter(([k, v]) => v && socials[k])

  return (
    <Window id="hello" name="about.me" closable={false} className="hero-win win-fixed">
      <div className="hero">
        <div className="hero-text">
          {/* 逐字升起：每个字晚 40ms，只在进页面时播一次；读屏读整句 */}
          <h1 className="hero-title" aria-label={greeting}>
            {[...greeting].map((ch, i) => (
              <span key={i} aria-hidden="true" style={{ "--i": i } as React.CSSProperties}>
                {ch === " " ? " " : ch}
              </span>
            ))}
          </h1>
          <p className="hero-sub">
            {info.title}
            {info.description && <span className="muted"> · {info.description}</span>}
          </p>
          {tags.length > 0 && (
            <ul className="hero-tags" aria-label="关于我">
              {tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <ul className="hero-links" aria-label="在别处找到我">
              {links.map(([k, v]) => {
                const s = socials[k]!
                return (
                  <li key={k}>
                    <a
                      href={s.href(v)}
                      target={k === "email" ? undefined : "_blank"}
                      rel="noopener me"
                      className="hero-social"
                      aria-label={s.label}
                      title={k === "email" ? v : s.label}
                    >
                      <s.Icon />
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {info.owner.avatar && (
          <div className="hero-avatar">
            <img src={info.owner.avatar} alt={`${info.owner.name} 的头像`} width={176} height={176} />
          </div>
        )}
      </div>
      {say && (
        <figure className="hero-say" title={say.text}>
          <blockquote>{say.text.replace(/\s*\n\s*/g, " / ")}</blockquote>
          <figcaption>
            {say.author && <>—— {say.author} · </>}
            <Link to="/says">更多一言</Link>
          </figcaption>
        </figure>
      )}
    </Window>
  )
}
