import { createAuthClient } from "better-auth/react"
import { site } from "@/lib/site"

/** 读者账号（Better Auth）。前台只有 GitHub / Google 登录；后台只认站长 */
export const auth = createAuthClient({ baseURL: site.api })
