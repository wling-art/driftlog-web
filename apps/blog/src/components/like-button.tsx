import { useEffect, useState } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"

/** 喜欢按钮：已喜欢显示实心爱心；进页面时按 IP 查有没有喜欢过 */
export function LikeButton({
  likes,
  like,
  liked,
  className,
}: {
  likes: number
  like: () => Promise<{ likes: number }>
  liked: () => Promise<{ liked: boolean }>
  className?: string
}) {
  const [state, setState] = useState({ n: likes, liked: false })
  useEffect(() => {
    let alive = true
    liked()
      .then((r) => alive && r.liked && setState((s) => ({ ...s, liked: true })))
      .catch(() => {})
    return () => {
      alive = false
    }
    // 只在挂载时查一次（文章页用 key 区分对象）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onClick = async () => {
    try {
      setState({ n: (await like()).likes, liked: true })
    } catch {
      setState((s) => ({ ...s, liked: true }))
    }
  }
  // 点过不禁用，再点不发请求
  return (
    <Button
      className={className}
      aria-pressed={state.liked}
      data-on={state.liked || undefined}
      onClick={() => !state.liked && void onClick()}
    >
      <Heart aria-hidden="true" fill={state.liked ? "currentColor" : "none"} />
      {state.liked ? "已喜欢" : "喜欢"}
      {state.n > 0 && ` ${state.n}`}
    </Button>
  )
}
