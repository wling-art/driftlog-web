import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Popover } from "radix-ui"
import { useTheme } from "@/components/boring"
import { entriesQuery, useSite } from "@/lib/api"
import { auth } from "@/lib/auth"
import { entryPath, formatDate } from "@/lib/site"
import { useUI } from "@/lib/store"

const sections = [
  { to: "/", label: "首页", home: true },
  { to: "/posts", label: "文章", count: "post" as const },
  { to: "/notes", label: "手记", count: "note" as const },
  { to: "/thinking", label: "动态" },
  { to: "/projects", label: "项目" },
  { to: "/says", label: "一言" },
  { to: "/friends", label: "友链" },
  { to: "/about", label: "关于", doc: true },
  { to: "/message", label: "留言板", doc: true },
]

/** 开始菜单：左列站长和栏目，右列最近文章和常用操作 */
export function StartMenu() {
  const [open, setOpen] = useState(false)
  const info = useSite()
  const close = () => setOpen(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="tb-start" aria-label="开始菜单">
        {info.owner.avatar ? <img src={info.owner.avatar} alt="" width={18} height={18} /> : null}
        开始
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="start-menu"
          aria-label="开始菜单"
        >
          {open && <MenuBody close={close} />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function MenuBody({ close }: { close: () => void }) {
  const info = useSite()
  const { theme, toggle } = useTheme()
  const user = auth.useSession().data?.user
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  const setAccountOpen = useUI((s) => s.setAccountOpen)
  // 与首页共用缓存
  const posts = useQuery(entriesQuery("post")).data
  const notes = useQuery(entriesQuery("note")).data
  const counts = { post: posts?.total, note: notes?.total }
  const recent = [...(posts?.items ?? []), ...(notes?.items ?? [])]
    .sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime())
    .slice(0, 4)

  return (
    <div className="start-grid">
      <div className="start-col">
        <div className="start-owner">
          {info.owner.avatar && <img src={info.owner.avatar} alt="" width={36} height={36} />}
          <div>
            <p className="start-owner-name">{info.owner.name}</p>
            <p className="start-owner-site">{info.title}</p>
          </div>
        </div>
        <nav aria-label="栏目" className="start-list">
          {sections.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              activeOptions={{ exact: "home" in s }}
              onClick={close}
              className="start-item"
              data-icon={"home" in s ? "home" : "doc" in s ? "doc" : "folder"}
            >
              <span className="start-item-label">{s.label}</span>
              {s.count && counts[s.count] !== undefined && (
                <span className="start-item-n">{counts[s.count]}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      <div className="start-col start-side">
        <p className="start-heading">最近</p>
        <ul className="start-recent">
          {recent.map((e) => (
            <li key={e.type + e.slug}>
              <Link to={entryPath(e.type, e.slug)} onClick={close} className="start-recent-item">
                <span className="start-recent-title">{e.title}</span>
                <time dateTime={formatDate(e.publishedAt)}>{formatDate(e.publishedAt).slice(5)}</time>
              </Link>
            </li>
          ))}
        </ul>
        <p className="start-heading">常用</p>
        <div className="start-actions">
          <button
            type="button"
            className="start-item"
            onClick={() => {
              close()
              setSearchOpen(true)
            }}
          >
            <span className="start-item-label">搜索</span>
            <kbd className="start-item-n only-fine">⌘K</kbd>
          </button>
          <button type="button" className="start-item" onClick={toggle}>
            <span className="start-item-label">{theme === "dark" ? "切到亮色" : "切到暗色"}</span>
          </button>
          <button
            type="button"
            className="start-item"
            onClick={() => {
              close()
              setAccountOpen(true)
            }}
          >
            <span className="start-item-label">{user ? `账号：${user.name}` : "登录 / 注册"}</span>
          </button>
          <a href="/feed.xml" className="start-item" onClick={close}>
            <span className="start-item-label">RSS 订阅</span>
          </a>
        </div>
      </div>
    </div>
  )
}
