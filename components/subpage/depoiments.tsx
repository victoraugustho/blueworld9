"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type VideoTestimonial = {
  id: string
  title?: string
}

const videos: VideoTestimonial[] = [
  { id: "d2rIOW-FZh4", title: "Paraguai" },
  { id: "RU6sDEaTsjU", title: "Rio de Janeiro" },
  { id: "hKyDvTrTrhQ", title: "Nova Iguaçu" },
  { id: "BjKLkS2lP2s", title: "Anápolis" },
]

export function VideoTestimonialsCarousel() {
  const [active, setActive] = useState(0)

  const prev = () =>
    setActive((i) => (i === 0 ? videos.length - 1 : i - 1))

  const next = () =>
    setActive((i) => (i === videos.length - 1 ? 0 : i + 1))

  return (
    <section className="relative w-full max-w-7xl mx-auto px-6 py-20">
      {/* VIEWPORT */}
      <div className="relative h-[520px] flex items-center justify-center overflow-hidden"
            style={{
                WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
                maskImage:
                "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
            }}
            >

        {videos.map((video, index) => {
          // offset relativo ao ativo (loop infinito)
          let offset = index - active
          if (offset > videos.length / 2) offset -= videos.length
          if (offset < -videos.length / 2) offset += videos.length

          /* CONFIGURAÇÕES VISUAIS */
          const translateX = offset * 260 // distância horizontal
          const scale =
            offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.82 : 0.7
          const opacity =
            offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.6 : 0
          const zIndex =
            offset === 0 ? 20 : Math.abs(offset) === 1 ? 10 : 0

          return (
            <div
              key={video.id}
              className="absolute transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                transform: `translateX(${translateX}px) scale(${scale})`,
                opacity,
                zIndex,
                width: 280,
                aspectRatio: "9 / 16",
              }}
            >
              {/* GLOW CENTRAL */}
              {offset === 0 && (
                <div
                  className="absolute -inset-3 rounded-2xl
                  bg-gradient-to-r from-cyan-500/40 via-blue-500/30 to-purple-500/40
                  blur-2xl opacity-90"
                />
              )}

              {/* VIDEO */}
              <div
                className="relative w-full h-full rounded-2xl overflow-hidden
                bg-white/5 backdrop-blur border border-white/10 shadow-xl"
              >
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1`}
                  title={video.title}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* CONTROLS */}
      <div className="flex justify-center gap-6 mt-12">
        <Button
          size="icon"
          variant="outline"
          onClick={prev}
          className="hover:bg-cyan-500/80 hover:border-cyan-500 hover:text-white transition"
        >
          <ChevronLeft />
        </Button>

        <Button
          size="icon"
          variant="outline"
          onClick={next}
          className="hover:bg-cyan-500/80 hover:border-cyan-500 hover:text-white transition"
        >
          <ChevronRight />
        </Button>
      </div>
    </section>
  )
}
