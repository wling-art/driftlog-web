import { expect, test } from "@playwright/test"

// 默认是本机的开发服务。开发环境连着正式库时，别对它跑：起一套连本地空库的环境，用 E2E_BLOG / E2E_ADMIN 指过去
const BLOG = process.env.E2E_BLOG ?? "http://localhost:5173"
const ADMIN = process.env.E2E_ADMIN ?? "http://localhost:5174"
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
  await page.keyboard.type("## 小标题\n\n这是==重点==。\n\n## 第二节\n\n收尾。")
  await expect(page.locator(".md-preview mark").first()).toHaveText("重点")
  await page.getByPlaceholder("hello-world").fill(slug)
  await page.getByRole("switch", { name: "发布" }).click()
  await page.getByRole("button", { name: /保存/ }).click()
  await expect(page.getByText("已保存并发布")).toBeVisible()
  await expect(page).toHaveURL(/\/entries\/\d+$/)
})

test("博客：首页、文章、目录、评论", async ({ page }) => {
  await page.goto(BLOG)
  await expect(page.locator(".win").first()).toBeVisible()
  // 开始菜单：点「开始」弹出，栏目能点进去，Esc 收起（时钟只在浏览器里渲染：它出来了说明已经水合）
  await expect(page.locator("time.clock")).toBeVisible()
  await page.getByRole("button", { name: "开始菜单" }).click()
  await expect(page.locator(".start-menu").getByRole("link", { name: /手记/ })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator(".start-menu")).toHaveCount(0)
  // 首页的桌面图标是快捷方式：点「文章」进文章栏目
  await page.getByRole("navigation", { name: "本页目录" }).getByRole("link", { name: "文章" }).click()
  await expect(page).toHaveURL(/\/posts$/)

  const target = email ? `/posts/${slug}` : "/posts"
  await page.goto(BLOG + target)
  if (!email) return
  await expect(page.getByRole("heading", { level: 2, name: "端到端测试" })).toBeVisible()
  // 目录：宽屏左边一张文字清单
  await expect(
    page.getByRole("navigation", { name: "文章目录" }).getByRole("link", { name: "小标题" }),
  ).toBeVisible()
  // 任务栏上的路径：盘符 / 文章 / …… / 这一篇
  await expect(page.getByRole("navigation", { name: "你在这里" })).toContainText("端到端测试")

  // 评论平时最小化在任务栏：页面上没有评论，点任务栏的「评论」才升起来
  await expect(page.getByRole("textbox", { name: "写评论" })).toHaveCount(0)
  await expect(page.locator("time.clock")).toBeVisible()
  const task = page.locator("#comments-task")
  await task.click()
  const float = page.getByRole("dialog", { name: /^评论：/ })
  await expect(float).toBeVisible()

  // 写评论：开始写才出现名字和邮箱；⌘ / Ctrl + 回车或按钮发送
  const box = float.getByRole("textbox", { name: "写评论" })
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

  // Esc 收回任务栏，焦点回到任务栏标签
  await box.press("Escape")
  await expect(float).toBeHidden()
  await expect(task).toBeFocused()
})

test("博客：⌘K 搜索", async ({ page }) => {
  await page.goto(BLOG)
  await expect(page.locator("time.clock")).toBeVisible() // 时钟挂载后才出现 = 已水合
  await page.keyboard.press("ControlOrMeta+k")
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  // 不依赖库里有什么：搜出结果或者「没搜到」都说明面板在工作
  await dialog.getByRole("combobox").fill("的")
  await expect(
    dialog
      .getByRole("option")
      .first()
      .or(dialog.getByText(/没搜到/)),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
})

test("博客：归档不分页；文章标题栏 ‹ › 和方向键翻篇", async ({ page }) => {
  await page.goto(`${BLOG}/posts`)
  await expect(page.locator("time.clock")).toBeVisible()
  await expect(page.getByRole("navigation", { name: "翻页" })).toHaveCount(0)
  await expect(page.locator(".archive-year").first()).toHaveText(/^\d{4}/)
  const rows = page.locator(".archive-row")
  test.skip((await rows.count()) < 3, "文章太少")

  // 打开中间一篇：标题栏上有 ‹ ›，→ 键去下一篇（归档新的在前，下一篇 = 列表里上面那一行）
  const newer = await rows.nth(0).getAttribute("href")
  await rows.nth(1).click()
  await expect(page.locator("time.clock")).toBeVisible()
  await expect(page.getByRole("link", { name: /^上一篇文章：/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /^下一篇文章：/ })).toHaveAttribute("href", newer!)
  await page.keyboard.press("ArrowRight")
  await expect(page).toHaveURL(new RegExp(`${newer}$`))
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
    [email ? `/og/post/${slug}` : "/robots.txt", email ? "image/png" : "text/plain"],
  ] as const) {
    const r = await request.get(BLOG + path)
    expect(r.ok(), path).toBe(true)
    expect(r.headers()["content-type"]).toContain(type)
  }
})
