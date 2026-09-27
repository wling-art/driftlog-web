import { createAuthClient } from "better-auth/react"
import { site } from "@/lib/site"

/** 读者账号（Better Auth）。前台只用邮箱登录 / 注册；后台只认站长 */
export const auth = createAuthClient({ baseURL: site.api })

/** Better Auth 的英文错误 → 人话 */
export function authError(e: { code?: string; status?: number; message?: string }) {
  if (e.status === 429) return "试得太快了，歇一分钟再来"
  switch (e.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "邮箱或密码不对"
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "这个邮箱注册过了，直接登录吧"
    case "PASSWORD_TOO_SHORT":
      return "密码至少 8 位"
    case "INVALID_EMAIL":
      return "邮箱格式不对"
    default:
      return e.message || "没成功，再试一次"
  }
}
