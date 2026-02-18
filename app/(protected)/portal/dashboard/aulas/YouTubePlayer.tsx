"use client"

import { useEffect, useRef } from "react"

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

  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
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

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
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
    <div className="relative w-full aspect-video mb-4 rounded-lg overflow-hidden bg-black/30">
      <div ref={containerRef} className="absolute inset-0" aria-label={title} />
    </div>
  )
}
