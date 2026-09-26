import { defineConfig, devices } from "@playwright/test"

// 需要先把 core 的 API 跑起来（默认 http://localhost:3900）；博客和后台由这里启动或复用
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    { command: "bun run dev:blog", url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
    {
      command: "bun run dev:admin",
      url: "http://localhost:5174",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
