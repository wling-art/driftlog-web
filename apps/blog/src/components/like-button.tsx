import { useState } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"

/** 喜欢按钮：只发一次请求，之后显示「已喜欢」 */
export function LikeButton({
  likes,
  like,
  className,
}: {
  likes: number
  like: () => Promise<{ likes: number }>
  className?: string
}) {
  const [state, setState] = useState({ n: likes, liked: false })
  const onClick = async () => {
    try {
      setState({ n: (await like()).likes, liked: true })
    } catch {
      setState((s) => ({ ...s, liked: true }))
    }
  }
  return (
    <Button
      className={className}
      aria-pressed={state.liked}
      data-on={state.liked || undefined}
      onClick={() => !state.liked && void onClick()}
    >
      <Heart aria-hidden="true" />
      {state.liked ? "已喜欢" : "喜欢"}
      {state.n > 0 && ` ${state.n}`}
    </Button>
  )
}
