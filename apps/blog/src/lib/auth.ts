import { createAuthClient } from "better-auth/react"
import { site } from "@/lib/site"

/** 读者账号（Better Auth 客户端） */
export const auth = createAuthClient({ baseURL: site.api })
