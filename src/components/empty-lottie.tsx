import { useLottie } from "lottie-react"
import { useReducedMotion } from "framer-motion"

import { emptyChatLottie } from "@/components/empty-lottie-data"

export function EmptyLottie({ label }: { label?: string }) {
  const reduced = useReducedMotion()
  const { View } = useLottie(
    {
      animationData: emptyChatLottie,
      loop: !reduced,
      autoplay: !reduced,
    },
    { width: "100%", height: "100%" },
  )

  return (
    <div className="mx-auto size-28" aria-hidden="true">
      {View}
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  )
}
