import type { CSSProperties, ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Mail } from "lucide-react"
import { BrandIcon } from "@/components/brand-icons"
import { unwrap } from "@driftlog/client"
import { Window } from "@/components/boring"
import { LikeButton } from "@/components/like-button"
import { api, type SiteSettings } from "@/lib/api"

// 社交账号：名字、图标、链接
const socials: Record<string, { label: string; icon: ReactNode; href: (v: string) => string }> = {
  github: { label: "GitHub", icon: <BrandIcon name="github" />, href: (v) => `https://github.com/${v}` },
  twitter: { label: "X", icon: <BrandIcon name="x" />, href: (v) => `https://x.com/${v}` },
  telegram: { label: "Telegram", icon: <BrandIcon name="telegram" />, href: (v) => `https://t.me/${v}` },
  bilibili: {
    label: "哔哩哔哩",
    icon: <BrandIcon name="bilibili" />,
    href: (v) => `https://space.bilibili.com/${v}`,
  },
  email: { label: "邮件", icon: <Mail aria-hidden="true" />, href: (v) => `mailto:${v}` },
}

type Say = { text: string; author: string | null; source: string | null } | null

/** 首页头部：问候、站名、标签、社交账号、头像、一言 */
export function Hero({ info, say }: { info: SiteSettings; say: Say }) {
  const greeting = `你好，我是 ${info.owner.name}`
  // 介绍按「｜」拆成标签，去掉和名字相同的一段
  const tags = info.owner.introduce
    .split(/[｜|]/)
    .map((t) => t.trim())
    .filter((t) => t && t !== info.owner.name)
  const links = Object.entries(info.owner.socials).filter(([k, v]) => v && socials[k])

  return (
    <Window id="hello" name="about.me" className="hero-win win-fixed">
      <div className="hero">
        <div className="hero-text">
          {/* 逐字动画；读屏读 aria-label 整句 */}
          <h1 className="hero-title" aria-label={greeting}>
            {[...greeting].map((ch, i) => (
              <span key={i} aria-hidden="true" style={{ "--i": i } as CSSProperties}>
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
          <ul className="hero-links" aria-label="在别处找到我">
            {links.map(([k, v]) => {
              const s = socials[k]!
              return (
                <li key={k}>
                  <a
                    href={s.href(v)}
                    target={k === "email" ? undefined : "_blank"}
                    rel="noopener me"
                    className="icon-link"
                    aria-label={s.label}
                    title={k === "email" ? v : s.label}
                  >
                    {s.icon}
                  </a>
                </li>
              )
            })}
            <li>
              <LikeButton
                likes={info.likes}
                like={() => unwrap(api.site.like.post())}
                liked={() => unwrap(api.site.like.get())}
                className="hero-like"
              />
            </li>
          </ul>
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
