"use client"

import { Play } from "lucide-react"

type YoutubeHeroEmbedProps = {
  videoId: string
  title?: string
}

export function YoutubeHeroEmbed({
  videoId,
  title = "Conheça a Blue World 9",
}: YoutubeHeroEmbedProps) {
  return (
    <section className="relative w-full max-w-5xl mx-auto px-6">
      {/* Wrapper */}
      <div className="relative group rounded-2xl overflow-hidden">

        {/* Glow BW9 */}
        <div
          className="absolute -inset-1 rounded-2xl 
          bg-gradient-to-r from-cyan-500/40 via-blue-500/30 to-purple-500/40
          blur-2xl opacity-60 group-hover:opacity-90 transition-opacity"
        />

        {/* Video Container */}
        <div
          className="relative aspect-video rounded-2xl overflow-hidden
          bg-white/5 backdrop-blur border border-white/10
          shadow-xl"
        >
          {/* IFRAME */}
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />

          {/* Overlay (hover aesthetic only) */}
          <div
            className="pointer-events-none absolute inset-0 
            bg-gradient-to-t from-slate-950/40 via-transparent to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity"
          />

          {/* Play icon (decorativo) */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center
              bg-cyan-500/80 backdrop-blur shadow-lg"
            >
              <Play className="w-7 h-7 text-white translate-x-[1px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="mt-6 my-20 text-center text-slate-300 text-lg">
        {title}
      </p>
    </section>
  )
}
