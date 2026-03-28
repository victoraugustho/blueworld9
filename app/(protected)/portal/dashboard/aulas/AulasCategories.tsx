"use client"

import { useMemo, useRef, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, PlayCircle } from "lucide-react"
import YouTubePlayer from "./YouTubePlayer"

const WATCH_THRESHOLD = 70
const PROGRESS_STEP = 5

type VideoItem = {
  id: string
  title: string
  description: string
  video_notes?: string | null
  file_url: string
  progress_percent?: number
  watched?: boolean
}

type CategoryBlock = {
  name: string
  videos: VideoItem[]
}

type Labels = {
  previous: string
  next: string
  lesson: string
  of: string
  watched: string
  videoNotes: string
  lessonList: string
}

type VideoWithEmbed = VideoItem & { embed: string | null }

type CategoryWithEmbed = {
  name: string
  videos: VideoWithEmbed[]
}

function extractYouTubeId(url: string): string | null {
  try {
    if (!url) return null
    if (url.includes("watch?v=")) return url.split("watch?v=")[1].split("&")[0]
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0]
    return null
  } catch {
    return null
  }
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export default function AulasCategories({
  categories,
  invalidUrlLabel,
  labels,
}: {
  categories: CategoryBlock[]
  invalidUrlLabel: string
  labels: Labels
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const initialMaps = useMemo(() => {
    const progressMap: Record<string, number> = {}
    const watchedMap: Record<string, boolean> = {}
    const indexMap: Record<string, number> = {}

    for (const cat of categories) {
      let firstUnwatched = -1
      cat.videos.forEach((video, idx) => {
        const progress = clampPercent(Number(video.progress_percent ?? 0))
        const watched = video.watched === true || progress >= WATCH_THRESHOLD
        progressMap[video.id] = progress
        watchedMap[video.id] = watched
        if (!watched && firstUnwatched === -1) firstUnwatched = idx
      })
      indexMap[cat.name] = firstUnwatched === -1 ? 0 : firstUnwatched
    }

    return { progressMap, watchedMap, indexMap }
  }, [categories])

  const [progressById, setProgressById] = useState<Record<string, number>>(
    () => initialMaps.progressMap
  )
  const [watchedById, setWatchedById] = useState<Record<string, boolean>>(
    () => initialMaps.watchedMap
  )
  const [currentIndexByCat, setCurrentIndexByCat] = useState<Record<string, number>>(
    () => initialMaps.indexMap
  )

  const lastSentRef = useRef<Record<string, number>>({})

  const normalized = useMemo<CategoryWithEmbed[]>(
    () =>
      categories.map((cat) => ({
        ...cat,
        videos: cat.videos.map((video) => ({
          ...video,
          embed: extractYouTubeId(video.file_url),
        })),
      })),
    [categories]
  )

  const categoryMap = useMemo<Record<string, VideoWithEmbed[]>>(() => {
    const map: Record<string, VideoWithEmbed[]> = {}
    for (const cat of normalized) map[cat.name] = cat.videos
    return map
  }, [normalized])

  function isOpen(key: string) {
    return open[key] === true
  }

  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function reportProgress(videoId: string, percent: number) {
    const last = lastSentRef.current[videoId] ?? -1
    const shouldSend =
      percent - last >= PROGRESS_STEP ||
      (percent >= WATCH_THRESHOLD && last < WATCH_THRESHOLD) ||
      (percent === 100 && last < 100)

    if (!shouldSend) return
    lastSentRef.current[videoId] = percent

    try {
      await fetch("/api/portal/video-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material_id: videoId, progress_percent: percent }),
      })
    } catch {
      // ignore network errors
    }
  }

  function handleProgress(categoryName: string, videoId: string, percent: number) {
    const clamped = clampPercent(percent)
    const currentProgress = progressById[videoId] ?? 0

    if (clamped > currentProgress) {
      setProgressById((prev) => {
        const current = prev[videoId] ?? 0
        if (clamped <= current) return prev
        return { ...prev, [videoId]: clamped }
      })
    }

    if (clamped >= WATCH_THRESHOLD && watchedById[videoId] !== true) {
      setWatchedById((prev) => ({ ...prev, [videoId]: true }))
    }

    reportProgress(videoId, clamped)
  }

  function handleEnded(categoryName: string, videoId: string) {
    setProgressById((prev) => ({ ...prev, [videoId]: 100 }))
    if (watchedById[videoId] !== true) {
      setWatchedById((prev) => ({ ...prev, [videoId]: true }))
    }

    const list = categoryMap[categoryName] ?? []
    const currentIndex = currentIndexByCat[categoryName] ?? 0
    if (list[currentIndex]?.id === videoId) {
      const nextIndex = Math.min(list.length - 1, currentIndex + 1)
      if (nextIndex !== currentIndex) {
        setCurrentIndexByCat((prev) => ({ ...prev, [categoryName]: nextIndex }))
      }
    }

    reportProgress(videoId, 100)
  }

  return (
    <div className="space-y-8">
      {normalized.map((categoria) => {
        const opened = isOpen(categoria.name)
        const count = categoria.videos.length
        const currentIndex = currentIndexByCat[categoria.name] ?? 0
        const currentVideo = categoria.videos[currentIndex] ?? categoria.videos[0]
        const isWatched = currentVideo
          ? watchedById[currentVideo.id] ?? currentVideo.watched ?? false
          : false

        return (
          <div key={categoria.name} className="bg-slate-900/30 border border-white/10 rounded-2xl">
            <button
              type="button"
              onClick={() => toggle(categoria.name)}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 text-cyan-400 font-semibold text-lg">
                  <PlayCircle className="w-5 h-5" />
                  {categoria.name}
                </span>
                <span className="text-xs text-slate-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5">
                  {count}
                </span>
              </div>
              <span className="text-slate-300">{opened ? <ChevronUp /> : <ChevronDown />}</span>
            </button>

            {opened && currentVideo && (
              <div className="px-5 pb-6">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
                  <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 backdrop-blur-xl shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="text-sm text-slate-300">
                        {labels.lesson} {currentIndex + 1} {labels.of} {count}
                      </div>
                      <div className="flex items-center gap-3">
                        {isWatched && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {labels.watched}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentIndexByCat((prev) => ({
                                ...prev,
                                [categoria.name]: Math.max(0, currentIndex - 1),
                              }))
                            }
                            disabled={currentIndex === 0}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition disabled:opacity-40 disabled:cursor-not-allowed bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            {labels.previous}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentIndexByCat((prev) => ({
                                ...prev,
                                [categoria.name]: Math.min(count - 1, currentIndex + 1),
                              }))
                            }
                            disabled={currentIndex >= count - 1}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition disabled:opacity-40 disabled:cursor-not-allowed bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                          >
                            {labels.next}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {currentVideo.embed ? (
                      <div className="max-w-4xl mx-auto">
                        <YouTubePlayer
                          videoId={currentVideo.embed}
                          title={currentVideo.title}
                          onProgress={({ currentTime, duration }) =>
                            handleProgress(
                              categoria.name,
                              currentVideo.id,
                              (currentTime / duration) * 100
                            )
                          }
                          onEnded={() => handleEnded(categoria.name, currentVideo.id)}
                        />
                      </div>
                    ) : (
                      <div className="text-red-400 mb-4">{invalidUrlLabel}</div>
                    )}

                    <h3 className="text-xl font-semibold text-white">{currentVideo.title}</h3>
                    <p className="text-slate-300 mt-1">{currentVideo.description}</p>

                    {String(currentVideo.video_notes ?? "").trim() ? (
                      <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">{labels.videoNotes}</p>
                        <p className="mt-1 text-sm text-cyan-100/90 whitespace-pre-wrap">
                          {currentVideo.video_notes}
                        </p>
                      </div>
                    ) : null}

                    <span className="inline-block mt-3 px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                      {categoria.name}
                    </span>
                  </div>

                  <aside className="bg-slate-900/55 border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{labels.lessonList}</p>
                      <span className="text-xs text-slate-300">{count}</span>
                    </div>

                    <div className="p-2 space-y-2 max-h-80 xl:max-h-[560px] overflow-y-auto">
                      {categoria.videos.map((video, idx) => {
                        const active = idx === currentIndex
                        const watched = watchedById[video.id] ?? video.watched ?? false
                        const cls = active
                          ? "border-cyan-400/60 bg-cyan-500/15"
                          : watched
                          ? "border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/15"
                          : "border-white/10 bg-white/5 hover:bg-white/10"

                        return (
                          <button
                            key={video.id}
                            type="button"
                            onClick={() =>
                              setCurrentIndexByCat((prev) => ({ ...prev, [categoria.name]: idx }))
                            }
                            className={`w-full rounded-lg border p-3 text-left transition ${cls}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-200">
                                {labels.lesson} {idx + 1}
                              </span>
                              {watched ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {labels.watched}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm font-medium text-white line-clamp-2">{video.title}</p>
                            {String(video.description ?? "").trim() ? (
                              <p className="mt-1 text-xs text-slate-300 line-clamp-2">{video.description}</p>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
