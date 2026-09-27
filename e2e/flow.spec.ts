import { expect, test } from "@playwright/test"

const BLOG = "http://localhost:5173"
const ADMIN = "http://localhost:5174"
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const slug = `e2e-${Date.now()}`

test.describe.configure({ mode: "serial" })

test("后台：登录、写一篇、实时预览、发布", async ({ page }) => {
  test.skip(!email || !password, "设置 E2E_EMAIL / E2E_PASSWORD（站长账号）才跑后台")
  await page.goto(ADMIN)
  await expect(page).toHaveURL(/\/login/)
  await page.fill("#email", email!)
  await page.fill("#password", password!)
  await page.click("button[type=submit]")
  await expect(page.getByRole("heading", { name: "概览" })).toBeVisible()

  await page.goto(`${ADMIN}/entries/new?type=post`)
  await page.getByLabel("标题").fill("端到端测试")
  await page.locator(".cm-content").click()
  await page.keyboard.type("## 小标题\n\n这是==重点==。")
  await expect(page.locator(".md-preview mark").first()).toHaveText("重点")
  await page.getByPlaceholder("hello-world").fill(slug)
  await page.getByRole("switch", { name: "发布" }).click()
  await page.getByRole("button", { name: /保存/ }).click()
  await expect(page.getByText("已保存并发布")).toBeVisible()
  await expect(page).toHaveURL(/\/entries\/\d+$/)
})

test("博客：首页、文章、目录、评论", async ({ page }) => {
  await page.goto(BLOG)
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible()
  await expect(page.locator(".win").first()).toBeVisible()

  const target = email ? `/posts/${slug}` : "/posts"
  await page.goto(BLOG + target)
  if (!email) return
  await expect(page.getByRole("heading", { level: 2, name: "端到端测试" })).toBeVisible()
  await expect(page.locator('a.folder[href="#小标题"]')).toBeVisible()
  await expect(page.getByRole("link", { name: "文章" })).toHaveAttribute("aria-current", "page")

  // 写评论：开始写才出现名字和邮箱；⌘ / Ctrl + 回车或按钮发送
  const box = page.getByRole("textbox", { name: "写评论" })
  await expect(page.getByRole("textbox", { name: "名字" })).toHaveCount(0)
  await box.fill("好")
  await page.getByRole("textbox", { name: "名字" }).fill("测试员")
  const emailBox = page.getByRole("textbox", { name: "邮箱（不公开）" })
  await emailBox.fill("bad")
  await page.getByRole("button", { name: "发表评论" }).click()
  await expect(page.getByText("✕ 邮箱格式不对")).toBeVisible()
  await emailBox.fill("tester@example.com")
  await expect(page.getByText("✕ 邮箱格式不对")).toBeHidden() // 改对就消失
  await box.press("ControlOrMeta+Enter")
  await expect(page.getByText(/评论发出去了|审核完就会出现/)).toBeVisible()
  // 记住了身份：下次不再问
  await expect(page.getByText("以 测试员 的身份")).toBeVisible()
  await box.fill("再来一条")
  await expect(page.getByRole("textbox", { name: "名字" })).toHaveCount(0)
})

test("博客：⌘K 搜索", async ({ page }) => {
  await page.goto(BLOG)
  await expect(page.locator("time.clock")).toBeVisible() // 时钟挂载后才出现 = 已水合
  await page.keyboard.press("ControlOrMeta+k")
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("combobox").fill("Driftlog")
  await expect(dialog.getByRole("option").first()).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
})

test("博客：翻页按钮、方向键、分类里翻页不丢筛选", async ({ page }) => {
  await page.goto(`${BLOG}/posts`)
  await expect(page.locator("time.clock")).toBeVisible()
  const pager = page.getByRole("navigation", { name: "翻页" })
  test.skip((await pager.count()) === 0, "文章不够两页")
  await expect(pager.getByRole("button", { name: "← 上一页" })).toBeDisabled() // 第一页：置灰但还在
  await expect(pager.getByRole("link", { name: "第 1 页" })).toHaveAttribute("aria-current", "page")
  await pager.getByRole("link", { name: "下一页 →" }).click()
  await expect(page).toHaveURL(/page=2/)
  // 等第 2 页真的渲染出来：Link 会按地址栏先把页码标成当前，那时内容可能还是第 1 页
  await expect(pager.getByRole("link", { name: "← 上一页" })).toBeVisible()
  await page.keyboard.press("ArrowLeft")
  await expect(page).toHaveURL(/page=1/)
})

test("博客：404 有出路", async ({ page }) => {
  const res = await page.goto(`${BLOG}/posts/does-not-exist-${Date.now()}`)
  expect(res?.status()).toBe(404)
  await expect(page.getByRole("heading", { name: "这页走丢了" })).toBeVisible()
  await expect(page.getByRole("link", { name: "回首页" })).toBeVisible()
})

test("SEO：订阅源、站点地图、OG 图", async ({ request }) => {
  for (const [path, type] of [
    ["/feed.xml", "rss"],
    ["/atom.xml", "atom"],
    ["/sitemap.xml", "xml"],
    ["/og/post/hello", "image/png"],
  ] as const) {
    const r = await request.get(BLOG + path)
    expect(r.ok(), path).toBe(true)
    expect(r.headers()["content-type"]).toContain(type)
  }
})
