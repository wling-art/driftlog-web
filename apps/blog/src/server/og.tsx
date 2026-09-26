import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import { formatDate, site } from "@/lib/site"

// Satori 不认 woff2，用上游的 TTF（public/fonts，SIL OFL 1.1）。每个实例只取一次
let font: Promise<ArrayBuffer> | null = null
const loadFont = (origin: string) =>
  (font ??= fetch(`${origin}/fonts/fusion-pixel-12px-proportional-zh_hans.ttf`).then((r) => {
    if (!r.ok) throw new Error(`字体没取到：${r.status}`)
    return r.arrayBuffer()
  }))

const c = {
  bg: "#CFD3D7",
  window: "#E1E4E7",
  bar: "#D7DADE",
  text: "#373737",
  muted: "#54575A",
  frame: "#9A9EA3",
  accent: "#255E65",
}

/** OG 图：一块灰桌面上的一个窗口，和站点长得一样 */
export async function ogImage(
  origin: string,
  e: { title: string; slug: string; type: string; publishedAt: string | Date | null },
) {
  const svg = await satori(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background: c.bg,
        fontFamily: "Pixel",
        color: c.text,
        padding: 48,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: c.window,
          border: `2px solid ${c.frame}`,
          borderRadius: 8,
          boxShadow: "0 20px 40px -20px rgba(40,44,48,.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 20px",
            background: c.bar,
            borderBottom: `2px solid ${c.frame}`,
            fontSize: 24,
          }}
        >
          <span>{`${e.slug}.md`}</span>
          <span>×</span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 56px",
          }}
        >
          <div style={{ fontSize: e.title.length > 18 ? 48 : 72, lineHeight: 1.3 }}>{e.title}</div>
          <div
            style={{ marginTop: 24, fontSize: 24, color: c.muted }}
          >{`// ${formatDate(e.publishedAt)}`}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, fontSize: 24 }}>
        <span style={{ color: c.accent }}>{site.name}</span>
        <span style={{ color: c.muted }}>{site.url.replace(/^https?:\/\//, "")}</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Pixel", data: await loadFont(origin), weight: 400, style: "normal" }],
    },
  )
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng()
}
