import { db } from "@/lib/db"
import { requireTeacherPage } from "@/lib/auth/server"
import { ensureTurmasSchema } from "@/lib/turmas"
import AulasCategories from "./AulasCategories"
import { getEffectivePortalLocale } from "@/lib/portal-locale"
import { isMaterialAccessPolicyReady, materialAccessSql } from "@/lib/material-access"

export default async function AulasPage() {
  const teacher = await requireTeacherPage()
  const locale = await getEffectivePortalLocale(teacher)

  await ensureTurmasSchema()

  const t = {
    title: locale === "es" ? "Clases en Video" : "Aulas em Video",
    noCategory: locale === "es" ? "Sin turma" : "Sem Turma",
    invalidUrl: locale === "es" ? "URL invalida o no es de YouTube." : "URL invalida ou nao e do YouTube.",
    empty: locale === "es" ? "No hay videos disponibles." : "Nenhuma aula em video disponivel.",
    previous: locale === "es" ? "Anterior" : "Anterior",
    next: locale === "es" ? "Siguiente" : "Proxima",
    lesson: locale === "es" ? "Clase" : "Aula",
    of: locale === "es" ? "de" : "de",
    watched: locale === "es" ? "Visto" : "Assistido",
    videoNotes: locale === "es" ? "Observaciones del video" : "Observacoes da aula",
    lessonList: locale === "es" ? "Lista de clases" : "Lista de aulas",
  }

  const policyReady = await isMaterialAccessPolicyReady()
  const accessFilter = policyReady
    ? materialAccessSql(teacher.id, locale)
    : db`
        m.language = ${locale}
        AND (m.category_id IS NULL OR EXISTS (
          SELECT 1 FROM teacher_categories tc
          WHERE tc.teacher_id = ${teacher.id} AND tc.category_id = m.category_id
        ))
        AND (m.student_year IS NULL OR EXISTS (
          SELECT 1 FROM teacher_student_years tys
          WHERE tys.teacher_id = ${teacher.id} AND tys.student_year = m.student_year
        ))
        AND (COALESCE(m.access_scope, 'all') = 'all' OR EXISTS (
          SELECT 1 FROM material_teacher_access mta
          WHERE mta.material_id = m.id AND mta.teacher_id = ${teacher.id}
        ))
      `

  const rows = await db`
    SELECT m.*, c.name AS category_name, p.progress_percent, p.watched_at
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    LEFT JOIN teacher_video_progress p
      ON p.material_id = m.id AND p.teacher_id = ${teacher.id}
    WHERE m.file_type = 'video'
      AND ${accessFilter}
    ORDER BY c.name ASC NULLS LAST, m.created_at ASC
  `

  const categorias = rows.reduce((acc: Record<string, any[]>, mat: any) => {
    const cat = mat.category_name || t.noCategory
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(mat)
    return acc
  }, {})

  const categories = Object.keys(categorias)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      videos: categorias[name].map((video: any) => ({
        id: String(video.id),
        title: video.title,
        description: video.description,
        video_notes: video.video_notes,
        file_url: video.file_url,
        progress_percent: Number(video.progress_percent ?? 0),
        watched:
          video.watched_at != null ||
          (Number(video.progress_percent ?? 0) >= 70 && Number.isFinite(video.progress_percent)),
      })),
    }))

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-8">{t.title}</h1>

      {categories.length === 0 ? (
        <p className="text-slate-400">{t.empty}</p>
      ) : (
        <AulasCategories
          categories={categories}
          invalidUrlLabel={t.invalidUrl}
          labels={{
            previous: t.previous,
            next: t.next,
            lesson: t.lesson,
            of: t.of,
            watched: t.watched,
            videoNotes: t.videoNotes,
            lessonList: t.lessonList,
          }}
        />
      )}
    </div>
  )
}
