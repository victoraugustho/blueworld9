import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"

function extractYouTubeId(url: string): string | null {
  try {
    if (!url) return null

    if (url.includes("watch?v=")) {
      return url.split("watch?v=")[1].split("&")[0]
    }
    if (url.includes("youtu.be/")) {
      return url.split("youtu.be/")[1].split("?")[0]
    }
    return null
  } catch {
    return null
  }
}

export default async function AulasPage() {
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) redirect("/portal/login")

  const [teacher] = await db`
    SELECT id, approved, active, locale
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `

  if (!teacher || teacher.approved !== true || teacher.active === false) {
    redirect("/portal/login")
  }

  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  const t = {
    title: locale === "es" ? "Clases en Video" : "Aulas em Vídeo",
    noCategory: locale === "es" ? "Sin categoría" : "Sem Categoria",
    invalidUrl: locale === "es" ? "URL inválida o no es de YouTube." : "URL inválida ou não é do YouTube.",
    empty: locale === "es" ? "No hay videos disponibles." : "Nenhuma aula em vídeo disponível.",
  }

  const rows = await db`
    SELECT m.*, c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.file_type = 'video'
      AND m.language = ${locale}
    ORDER BY c.name ASC NULLS LAST, m.created_at DESC
  `

  const categorias = rows.reduce((acc: Record<string, any[]>, mat: any) => {
    const cat = mat.category_name || t.noCategory
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(mat)
    return acc
  }, {})

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-8">{t.title}</h1>

      {Object.keys(categorias).length === 0 && (
        <p className="text-slate-400">{t.empty}</p>
      )}

      {Object.keys(categorias).map((categoria) => (
        <div key={categoria} className="mb-12">
          <h2 className="text-2xl font-semibold text-cyan-400 mb-4">{categoria}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categorias[categoria].map((video: any) => {
              const id = extractYouTubeId(video.file_url)
              const embed = id ? `https://www.youtube.com/embed/${id}` : null

              return (
                <div
                  key={video.id}
                  className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 backdrop-blur-xl shadow-xl"
                >
                  {embed ? (
                    <iframe
                      className="rounded-lg w-full aspect-video mb-4"
                      src={embed}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="text-red-400 mb-4">{t.invalidUrl}</div>
                  )}

                  <h2 className="text-xl font-semibold text-white">{video.title}</h2>
                  <p className="text-slate-300 mt-1">{video.description}</p>

                  <span className="inline-block mt-3 px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                    {categoria}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
