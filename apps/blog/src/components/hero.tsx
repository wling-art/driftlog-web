import { Link } from "@tanstack/react-router"
import { Mail } from "lucide-react"
import { BrandIcon } from "@/components/brand-icons"
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

// 社交账号 → 链接、图标、名字。按钮只放图标（这几个标志一眼认得出），名字给读屏和悬停提示
const socials: Record<string, { label: string; Icon: () => React.ReactNode; href: (v: string) => string }> = {
  github: {
    label: "GitHub",
    Icon: () => <BrandIcon name="github" />,
    href: (v) => `https://github.com/${v}`,
  },
  twitter: { label: "X", Icon: () => <BrandIcon name="x" />, href: (v) => `https://x.com/${v}` },
  telegram: {
    label: "Telegram",
    Icon: () => <BrandIcon name="telegram" />,
    href: (v) => `https://t.me/${v}`,
  },
  bilibili: {
    label: "哔哩哔哩",
    Icon: () => <BrandIcon name="bilibili" />,
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
    <Window id="hello" name="about.me" className="hero-win win-fixed">
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
