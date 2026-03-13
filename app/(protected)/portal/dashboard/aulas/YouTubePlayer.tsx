"use client"

import { useEffect, useRef, useState } from "react"

type ProgressPayload = {
  currentTime: number
  duration: number
}

type YouTubePlayerProps = {
  videoId: string
  title: string
  onProgress?: (payload: ProgressPayload) => void
  onEnded?: () => void
}

const YT_API_SRC = "https://www.youtube.com/iframe_api"

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
    __ytApiPromise?: Promise<void>
  }
}

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.YT && window.YT.Player) return Promise.resolve()

  if (window.__ytApiPromise) return window.__ytApiPromise

  window.__ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev()
      resolve()
    }

    const script = document.createElement("script")
    script.src = YT_API_SRC
    script.async = true
    document.body.appendChild(script)
  })

  return window.__ytApiPromise
}

export default function YouTubePlayer({ videoId, title, onProgress, onEnded }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<any>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  const [coverVisible, setCoverVisible] = useState(true)

  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    setCoverVisible(true)
    let mounted = true

    function clearTick() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    function tick() {
      const player = playerRef.current
      if (!player) return
      const duration = player.getDuration?.()
      const currentTime = player.getCurrentTime?.()
      if (!duration || !Number.isFinite(duration) || !Number.isFinite(currentTime)) return
      onProgressRef.current?.({ currentTime, duration })
    }

    function startTick() {
      if (intervalRef.current) return
      tick()
      intervalRef.current = setInterval(() => {
        if (document.visibilityState !== "visible") return
        tick()
      }, 5000)
    }

    function handleStateChange(event: any) {
      const state = event?.data
      if (state === window.YT?.PlayerState?.PLAYING) {
        setCoverVisible(false)
        startTick()
        return
      }

      if (state === window.YT?.PlayerState?.ENDED) {
        tick()
        clearTick()
        onEndedRef.current?.()
        return
      }

      if (state === window.YT?.PlayerState?.PAUSED) {
        clearTick()
      }
    }

    loadYouTubeApi().then(() => {
      if (!mounted || !containerRef.current) return

      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }

      const origin = window.location?.origin
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          controls: 1,
          fs: 1,
          disablekb: 1,
          iv_load_policy: 3,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin,
        },
        events: {
          onReady: () => {
            if (mounted) setCoverVisible(true)
            try {
              const iframe = playerRef.current?.getIframe?.()
              if (iframe) {
                iframe.setAttribute("allowfullscreen", "true")
                iframe.setAttribute("allowFullScreen", "true")
                const currentAllow = iframe.getAttribute("allow") ?? ""
                if (!currentAllow.includes("fullscreen")) {
                  iframe.setAttribute("allow", `${currentAllow} fullscreen`.trim())
                }
              }
            } catch {}
          },
          onStateChange: handleStateChange,
        },
      })
    })

    return () => {
      mounted = false
      clearTick()
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [videoId])

  return (
    <div
      className="relative w-full aspect-video mb-4 rounded-lg overflow-hidden bg-black/30"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={containerRef} className="absolute inset-0" aria-label={title} />
      {coverVisible && (
        <button
          type="button"
          onClick={() => {
            if (playerRef.current?.playVideo) {
              playerRef.current.playVideo()
              setCoverVisible(false)
            }
          }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-slate-950/70 via-slate-900/50 to-slate-950/70"
          aria-label="Reproduzir vídeo"
        >
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 border border-white/20">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7-11-7z" fill="white" />
            </svg>
          </span>
        </button>
      )}
      {/* overlays para reduzir cliques em links do player */}
      <div className="absolute top-0 left-0 w-24 h-12 z-10" aria-hidden />
      <div className="absolute top-0 right-0 w-24 h-12 z-10" aria-hidden />
    </div>
  )
}
