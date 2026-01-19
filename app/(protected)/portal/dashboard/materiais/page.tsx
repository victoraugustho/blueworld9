import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { FileText, Eye } from "lucide-react"
import Link from "next/link"

export default async function MateriaisPage() {
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
    title: locale === "es" ? "Materiales de Apoyo" : "Materiais de Apoio",
    empty: locale === "es" ? "No hay materiales disponibles." : "Nenhum material disponível.",
    view: locale === "es" ? "Ver" : "Visualizar",
    noCategory: locale === "es" ? "Sin categoría" : "Sem Categoria",
  }

  const materiais = await db`
    SELECT m.*, c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.file_type = 'document'
      AND m.language = ${locale}
    ORDER BY c.name ASC NULLS LAST, m.created_at DESC
  `

  const categorias = materiais.reduce((acc: Record<string, any[]>, mat: any) => {
    const cat = mat.category_name || t.noCategory
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(mat)
    return acc
  }, {})

  return (
    <div className="text-white p-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <FileText className="w-7 h-7 text-purple-400" />
        {t.title}
      </h1>

      {Object.keys(categorias).length === 0 && <p className="text-slate-400">{t.empty}</p>}

      {Object.keys(categorias).map((categoria) => (
        <div key={categoria} className="mb-10">
          <h2 className="text-2xl font-semibold text-purple-400 mb-4">{categoria}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categorias[categoria].map((mat: any) => (
              <div
                key={mat.id}
                className="p-5 rounded-xl bg-slate-800/40 border border-slate-700 hover:border-purple-500/40 transition backdrop-blur-xl shadow-lg"
              >
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5 text-purple-400" />
                  {mat.title}
                </h3>

                <p className="text-slate-400 mt-2 mb-4">{mat.description}</p>

                <div className="flex justify-between items-center">
                  <span className="text-xs bg-purple-500/20 px-3 py-1 rounded-full text-purple-300">
                    {categoria}
                  </span>

                  <Link href={mat.file_url} target="_blank">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 hover:opacity-90 transition">
                      <Eye className="w-4 h-4" />
                      {t.view}
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
