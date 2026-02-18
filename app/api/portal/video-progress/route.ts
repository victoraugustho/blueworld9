import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"

const WATCH_THRESHOLD = 70

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTeacherApi()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const materialId = String(body?.material_id ?? "").trim()
    const progressRaw = Number(body?.progress_percent)

    if (!materialId) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 })
    }

    if (!Number.isFinite(progressRaw)) {
      return NextResponse.json({ error: "Progresso invalido" }, { status: 400 })
    }

    const progress = Math.max(0, Math.min(100, Math.round(progressRaw)))
    const watchedAt = progress >= WATCH_THRESHOLD ? new Date() : null

    await db`
      INSERT INTO teacher_video_progress (teacher_id, material_id, progress_percent, watched_at, updated_at)
      VALUES (${auth.teacherId}, ${materialId}, ${progress}, ${watchedAt}, NOW())
      ON CONFLICT (teacher_id, material_id)
      DO UPDATE SET
        progress_percent = GREATEST(teacher_video_progress.progress_percent, EXCLUDED.progress_percent),
        watched_at = COALESCE(teacher_video_progress.watched_at, EXCLUDED.watched_at),
        updated_at = NOW()
    `

    return NextResponse.json({ ok: true, progress_percent: progress, watched: progress >= WATCH_THRESHOLD })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
