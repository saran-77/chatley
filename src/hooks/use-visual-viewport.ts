import { useEffect, useState } from "react"

function viewportHeight() {
  return window.visualViewport?.height ?? window.innerHeight
}

export function useVisualViewportHeight() {
  const [height, setHeight] = useState(viewportHeight)

  useEffect(() => {
    const viewport = window.visualViewport
    function update() {
      setHeight(viewportHeight())
    }
    update()
    viewport?.addEventListener("resize", update)
    viewport?.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    return () => {
      viewport?.removeEventListener("resize", update)
      viewport?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return height
}
