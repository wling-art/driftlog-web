import { unwrap } from "@driftlog/client"
import { api } from "@/lib/api"
import { entryPath, site } from "@/lib/site"

const esc = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!)
const cdata = (s: string) => `<![CDATA[${s.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`

async function items() {
  const all = await unwrap(api.entries.feed.get())
  return all
    .filter((e) => e.type !== "page")
    .slice(0, 30)
    .map((e) => ({ ...e, link: `${site.url}${entryPath(e.type, e.slug)}` }))
}

const xml = (body: string, type: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { "content-type": `${type}; charset=utf-8` },
  })

export async function rss() {
  const list = await items()
  return xml(
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${esc(site.name)}</title><link>${site.url}</link><description>${esc(site.description)}</description><language>zh-CN</language>
<atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>
${list
  .map(
    (
      e,
    ) => `<item><title>${esc(e.title)}</title><link>${e.link}</link><guid isPermaLink="true">${e.link}</guid>
<pubDate>${new Date(e.publishedAt ?? e.updatedAt).toUTCString()}</pubDate><description>${cdata(e.html)}</description></item>`,
  )
  .join("\n")}
</channel></rss>`,
    "application/rss+xml",
  )
}

export async function atom() {
  const list = await items()
  const updated = list[0]?.updatedAt ?? new Date().toISOString()
  return xml(
    `<feed xmlns="http://www.w3.org/2005/Atom">
<title>${esc(site.name)}</title><subtitle>${esc(site.description)}</subtitle><id>${site.url}/</id>
<link href="${site.url}"/><link rel="self" href="${site.url}/atom.xml"/><updated>${new Date(updated).toISOString()}</updated>
<author><name>${esc(site.author)}</name></author>
${list
  .map(
    (e) => `<entry><title>${esc(e.title)}</title><id>${e.link}</id><link href="${e.link}"/>
<published>${new Date(e.publishedAt ?? e.updatedAt).toISOString()}</published><updated>${new Date(e.updatedAt).toISOString()}</updated>
<summary>${esc(e.summary ?? e.excerpt)}</summary><content type="html">${cdata(e.html)}</content></entry>`,
  )
  .join("\n")}
</feed>`,
    "application/atom+xml",
  )
}

export async function sitemap() {
  const all = await unwrap(api.entries.feed.get())
  const urls = [
    { loc: site.url, lastmod: all[0]?.updatedAt },
    { loc: `${site.url}/posts` },
    { loc: `${site.url}/notes` },
    ...all.map((e) => ({ loc: `${site.url}${entryPath(e.type, e.slug)}`, lastmod: e.updatedAt })),
  ]
  return xml(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`,
    "application/xml",
  )
}
