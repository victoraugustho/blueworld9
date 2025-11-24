"use client"

import { useEffect, useState } from "react"

export function ScrollIndicator() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.body.scrollHeight - window.innerHeight

      const percent = docHeight > 0 ? scrollTop / docHeight : 0
      setProgress(percent)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div
      className="
        fixed 
        right-2 
        top-[20vh] 
        h-[60vh] 
        w-[7px] 
        rounded-full 
        bg-cyan-600/30 
        backdrop-blur-sm 
        border border-white/10 
        z-[15]
      "
    >
      <div
        className="
          w-full 
          rounded-full 
          bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600 
          shadow-[0_0_12px_rgba(56,189,248,0.7)]
          transition-all duration-150
        "
        style={{
          // tamanho mínimo pra sempre aparecer um "thumb"
          height: `${Math.max(12, progress * 100)}%`,
        }}
      />
    </div>
  )
}
