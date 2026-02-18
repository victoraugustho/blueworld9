import { db } from "@/lib/db"
import { requireTeacherPage } from "@/lib/auth/server"
import { FileText, Eye } from "lucide-react"
import Link from "next/link"

type SearchParams = { year?: string | string[] }

export default async function MateriaisPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  const t = {
    title: locale === "es" ? "Materiales de Apoyo" : "Materiais de Apoio",
    empty: locale === "es" ? "No hay materiales disponibles." : "Nenhum material disponivel.",
    view: locale === "es" ? "Ver" : "Visualizar",
    noCategory: locale === "es" ? "Sin categoria" : "Sem Categoria",
    yearLabel: "Ano",
    noYear: locale === "es" ? "Sin ano" : "Sem ano",
    yearTitle: locale === "es" ? "Ano del Alumno" : "Ano do Aluno",
    ageLabel: "anos",
    highLabel: locale === "es" ? "Ensenanza Media" : "Ensino Medio",
  }

  const materiais = await db`
    SELECT m.*, c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.file_type = 'document'
      AND m.language = ${locale}
    ORDER BY c.name ASC NULLS LAST, m.created_at DESC
  `

  function getYearInfo(value: any) {
    if (typeof value === "number") {
      if (value >= 103 && value <= 105) {
        const age = value - 100
        return { key: `age-${age}`, label: `${age} ${t.ageLabel}` }
      }
      if (value >= 1 && value <= 9) {
        return { key: `grade-${value}`, label: `${t.yearLabel} ${value}` }
      }
      if (value >= 201 && value <= 203) {
        const year = value - 200
        return { key: `hs-${year}`, label: `${t.highLabel} ${year}` }
      }
    }
    return { key: "none", label: t.noYear }
  }

  const yearMap = new Map<string, string>()
  const materialsWithYear = materiais.map((mat: any) => {
    const info = getYearInfo(mat.student_year)
    yearMap.set(info.key, info.label)
    return { ...mat, yearKey: info.key }
  })

  const yearOrder = [
    "age-3",
    "age-4",
    "age-5",
    "grade-1",
    "grade-2",
    "grade-3",
    "grade-4",
    "grade-5",
    "grade-6",
    "grade-7",
    "grade-8",
    "grade-9",
    "hs-1",
    "hs-2",
    "hs-3",
    "none",
  ]

  const yearOptions = yearOrder
    .filter((key) => yearMap.has(key))
    .map((key) => ({ key, label: yearMap.get(key)! }))

  const resolvedSearch = (await searchParams) ?? {}
  const yearParamRaw = Array.isArray(resolvedSearch.year) ? resolvedSearch.year[0] : resolvedSearch.year
  const yearParam = yearParamRaw ?? yearOptions[0]?.key
  const selected = yearOptions.find((o) => o.key === yearParam) ?? yearOptions[0]

  const filtered = selected
    ? materialsWithYear.filter((mat: any) => mat.yearKey === selected.key)
    : []

  const categorias = filtered.reduce((acc: Record<string, any[]>, mat: any) => {
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

      {yearOptions.length > 0 && (
        <div className="mb-8">
          <p className="text-sm text-slate-300 mb-2">{t.yearTitle}</p>
          <div className="flex flex-wrap gap-2">
            {yearOptions.map((opt) => {
              const active = selected?.key === opt.key
              return (
                <Link key={opt.key} href={`/portal/dashboard/materiais?year=${opt.key}`}>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
                      active
                        ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                        : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

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
