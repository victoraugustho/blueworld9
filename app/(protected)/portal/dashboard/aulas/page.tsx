import { db } from "@/lib/db"
import { requireTeacherPage } from "@/lib/auth/server"
import AulasCategories from "./AulasCategories"

export default async function AulasPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  const t = {
    title: locale === "es" ? "Clases en Video" : "Aulas em Vídeo",
    noCategory: locale === "es" ? "Sin categoría" : "Sem Categoria",
    invalidUrl: locale === "es" ? "URL inválida o no es de YouTube." : "URL inválida ou não é do YouTube.",
    empty: locale === "es" ? "No hay videos disponibles." : "Nenhuma aula em vídeo disponível.",
    previous: locale === "es" ? "Anterior" : "Anterior",
    next: locale === "es" ? "Siguiente" : "Próxima",
    lesson: locale === "es" ? "Clase" : "Aula",
    of: locale === "es" ? "de" : "de",
    watched: locale === "es" ? "Visto" : "Assistido",
  }

  const rows = await db`
    SELECT m.*, c.name AS category_name, p.progress_percent, p.watched_at
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    LEFT JOIN teacher_video_progress p
      ON p.material_id = m.id AND p.teacher_id = ${teacher.id}
    WHERE m.file_type = 'video'
      AND m.language = ${locale}
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
          }}
        />
      )}
    </div>
  )
}
