"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Eye, Pencil, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDatePtBr } from "@/lib/format-date"
import { getTurmaYearLabel } from "@/lib/turma-years"
import NotasSectionNav from "../../_components/NotasSectionNav"

type Locale = "pt-BR" | "es"

type ClassDetail = {
  id: string
  name: string
  school_year: number
  student_year?: number | null
  active: boolean
}

type StudentOverview = {
  student_id: string
  full_name: string
  active: boolean
  entries_count: number
  presence_count: number
  absence_count: number
  attendance_percent: number | null
  b1_final_grade: number | null
  b2_final_grade: number | null
  b3_final_grade: number | null
  b4_final_grade: number | null
}

type BimesterDetail = {
  bimester: number
  entries_count: number
  graded_lessons: number
  presence_count: number
  absence_count: number
  note1: number | null
  has_exam: boolean
  exam_score: number | null
  c5_score: number | null
  note2: number | null
  final_grade: number | null
  notes?: string | null
  updated_at?: string | null
}

type LessonDetail = {
  lesson_id: string
  bimester: number
  lesson_number: number
  lesson_date: string
  lesson_notes?: string | null
  attendance?: "present" | "absent" | null
  c1: number | null
  c2: number | null
  c3: number | null
  c4: number | null
  lesson_average: number | null
  comment?: string | null
  updated_at?: string | null
}

type StudentInsight = {
  class: ClassDetail
  student: {
    id: string
    full_name: string
    active: boolean
    created_at?: string | null
    updated_at?: string | null
  }
  totals: {
    entries_count: number
    presence_count: number
    absence_count: number
    attendance_percent: number | null
  }
  bimesters: BimesterDetail[]
  lessons: LessonDetail[]
}

function displayGrade(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return Number(value).toFixed(2)
}

function displayPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return `${Number(value).toFixed(2)}%`
}

export default function TurmaDetalheClient({
  locale,
  classId,
  isAdmin,
}: {
  locale: Locale
  classId: string
  isAdmin: boolean
}) {
  const isEs = locale === "es"

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [classData, setClassData] = useState<ClassDetail | null>(null)
  const [schoolYear, setSchoolYear] = useState<number>(new Date().getFullYear())
  const [rows, setRows] = useState<StudentOverview[]>([])
  const [search, setSearch] = useState("")

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [detailData, setDetailData] = useState<StudentInsight | null>(null)

  async function loadData(targetYear?: number) {
    const year = targetYear ?? schoolYear
    setLoading(true)
    setError("")

    const [classRes, insightsRes] = await Promise.all([
      fetch(`/api/portal/gradebook/classes/${classId}`, { cache: "no-store" }),
      fetch(`/api/portal/gradebook/classes/${classId}/insights?schoolYear=${year}`, { cache: "no-store" }),
    ])

    const classJson = await classRes.json().catch(() => null)
    const insightsJson = await insightsRes.json().catch(() => ({}))

    if (!classRes.ok) {
      setClassData(null)
      setRows([])
      setError(isEs ? "No se pudo cargar la turma." : "Nao foi possivel carregar a turma.")
      setLoading(false)
      return
    }

    if (!insightsRes.ok) {
      setClassData(classJson)
      setRows([])
      setError(isEs ? "No se pudo cargar metricas." : "Nao foi possivel carregar metricas.")
      setLoading(false)
      return
    }

    const serverClass = insightsJson?.class ?? classJson
    setClassData(serverClass)
    setSchoolYear(Number(serverClass?.school_year ?? year))

    const list: StudentOverview[] = Array.isArray(insightsJson?.students) ? insightsJson.students : []
    setRows(list)
    setLoading(false)
  }

  useEffect(() => {
    if (!classId) {
      setLoading(false)
      setError(isEs ? "Turma invalida." : "Turma invalida.")
      return
    }

    loadData().catch(() => {
      setLoading(false)
      setError(isEs ? "No se pudo cargar la turma." : "Nao foi possivel carregar a turma.")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  async function reloadByYear() {
    await loadData(schoolYear)
  }

  async function openDetails(studentId: string) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError("")
    setDetailData(null)

    try {
      const res = await fetch(
        `/api/portal/gradebook/classes/${classId}/students/${studentId}/insights?schoolYear=${schoolYear}`,
        { cache: "no-store" },
      )
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setDetailError(isEs ? "No se pudo cargar detalles." : "Nao foi possivel carregar detalhes.")
        setDetailLoading(false)
        return
      }

      setDetailData(data)
      setDetailLoading(false)
    } catch {
      setDetailError(isEs ? "No se pudo cargar detalles." : "Nao foi possivel carregar detalhes.")
      setDetailLoading(false)
    }
  }

  const turmaYearLabel = classData?.student_year
    ? getTurmaYearLabel(classData.student_year)
    : isEs
      ? "Sin ano"
      : "Sem ano"

  const activeStudents = useMemo(
    () => rows.filter((item) => item.active === true).length,
    [rows],
  )

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((item) => String(item.full_name ?? "").toLowerCase().includes(term))
  }, [rows, search])

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Eye className="w-7 h-7 text-cyan-300" />
            {classData?.name || (isEs ? "Visualizar Turma" : "Visualizar Turma")}
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            {isEs
              ? "Lista compacta con frecuencia y nota final por bimestre."
              : "Lista compacta com frequencia e nota final por bimestre."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/portal/dashboard/notas/turmas/${classId}/editar`}>
                <Pencil className="w-4 h-4 mr-2" />
                {isEs ? "Editar" : "Editar"}
              </Link>
            </Button>
          )}
          <Button asChild className="bg-white/10 hover:bg-white/15 border border-white/10">
            <Link href="/portal/dashboard/notas/turmas">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isEs ? "Volver" : "Voltar"}
            </Link>
          </Button>
        </div>
      </div>

      <NotasSectionNav locale={locale} />

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-white">{isEs ? "Ano lectivo" : "Ano letivo"}</Label>
              <Input
                type="number"
                value={schoolYear}
                onChange={(e) => setSchoolYear(Number(e.target.value || new Date().getFullYear()))}
                className="mt-1 w-36 bg-slate-800/70 border-slate-700 text-white ml-2"
              />
            </div>
            <Button onClick={reloadByYear} className="bg-white/10 hover:bg-white/15 border border-white/10">
              {isEs ? "Actualizar" : "Atualizar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-300">{isEs ? "Cargando..." : "Carregando..."}</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && classData ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-slate-300 uppercase tracking-wide">{isEs ? "Ano turma" : "Ano turma"}</p>
                <p className="text-lg font-semibold text-white mt-1">{turmaYearLabel}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-slate-300 uppercase tracking-wide">{isEs ? "Ano lectivo" : "Ano letivo"}</p>
                <p className="text-lg font-semibold text-white mt-1">{schoolYear}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-slate-300 uppercase tracking-wide">{isEs ? "Alumnos" : "Alunos"}</p>
                <p className="text-lg font-semibold text-white mt-1">{rows.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-slate-300 uppercase tracking-wide">{isEs ? "Activos" : "Ativos"}</p>
                <p className="text-lg font-semibold text-white mt-1">{activeStudents}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-300" />
                {isEs ? "Alumnos de la Turma" : "Alunos da Turma"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <Label className="text-white">{isEs ? "Buscar alumno" : "Buscar aluno"}</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mt-1 max-w-md bg-slate-800/70 border-slate-700 text-white ml-2"
                  placeholder={isEs ? "Nombre del alumno" : "Nome do aluno"}
                />
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {isEs ? "No hay alumnos para este ano." : "Nao ha alunos para este ano."}
                </p>
              ) : (
                <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-950/30">
                  <div className="overflow-x-auto">
                    <table className="min-w-[860px] w-full text-sm text-slate-100">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.04] text-slate-200">
                          <th className="text-left py-2.5 px-3">Aluno</th>
                          <th className="text-left py-2.5 px-3">Frequencia</th>
                          <th className="text-left py-2.5 px-3">B1</th>
                          <th className="text-left py-2.5 px-3">B2</th>
                          <th className="text-left py-2.5 px-3">B3</th>
                          <th className="text-left py-2.5 px-3">B4</th>
                          <th className="text-left py-2.5 px-3">Status</th>
                          <th className="text-left py-2.5 px-3">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((student) => (
                          <tr key={student.student_id} className="border-b border-white/10 last:border-b-0 odd:bg-white/[0.02]">
                            <td className="py-2.5 px-3 text-white font-medium truncate max-w-[260px]">{student.full_name}</td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-600/25 text-cyan-100">
                                {displayPercent(student.attendance_percent)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">{displayGrade(student.b1_final_grade)}</td>
                            <td className="py-2.5 px-3">{displayGrade(student.b2_final_grade)}</td>
                            <td className="py-2.5 px-3">{displayGrade(student.b3_final_grade)}</td>
                            <td className="py-2.5 px-3">{displayGrade(student.b4_final_grade)}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${student.active ? "bg-emerald-600/30 text-emerald-100" : "bg-rose-600/30 text-rose-100"}`}>
                                {student.active ? (isEs ? "Activo" : "Ativo") : (isEs ? "Inactivo" : "Inativo")}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <Button
                                size="icon-sm"
                                className="bg-white/10 hover:bg-white/20 border border-white/15"
                                onClick={() => openDetails(student.student_id)}
                                title={isEs ? "Ver detalles" : "Ver detalhes"}
                                aria-label={isEs ? "Ver detalles" : "Ver detalhes"}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-3 px-3 text-sm text-slate-400">
                              {isEs ? "Sin resultados para la busqueda." : "Sem resultados para a busca."}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {!loading && !classData ? (
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-400">{isEs ? "Turma no encontrada." : "Turma nao encontrada."}</p>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {detailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDetailOpen(false)}
            aria-label={isEs ? "Cerrar" : "Fechar"}
          />

          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl border border-white/15 bg-slate-950 text-white shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80">
              <div>
                <p className="text-sm text-slate-300">{isEs ? "Detalle del alumno" : "Detalhes do aluno"}</p>
                <h3 className="text-lg font-semibold text-white">{detailData?.student?.full_name || "-"}</h3>
              </div>
              <Button
                size="icon-sm"
                className="bg-white/10 hover:bg-white/20 border border-white/15"
                onClick={() => setDetailOpen(false)}
                aria-label={isEs ? "Cerrar" : "Fechar"}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-64px)] p-4 space-y-4">
              {detailLoading ? <p className="text-sm text-slate-300">{isEs ? "Cargando..." : "Carregando..."}</p> : null}
              {detailError ? <p className="text-sm text-rose-300">{detailError}</p> : null}

              {!detailLoading && !detailError && detailData ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <p><span className="text-slate-400">ID:</span> {detailData.student.id}</p>
                    <p><span className="text-slate-400">Status:</span> {detailData.student.active ? (isEs ? "Activo" : "Ativo") : (isEs ? "Inactivo" : "Inativo")}</p>
                    <p><span className="text-slate-400">Ano letivo:</span> {detailData.class.school_year}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-slate-900/40 border border-white/10">
                      <CardContent className="pt-4">
                        <p className="text-xs text-slate-300">Presencas</p>
                        <p className="text-lg font-semibold text-white">{detailData.totals.presence_count}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900/40 border border-white/10">
                      <CardContent className="pt-4">
                        <p className="text-xs text-slate-300">Faltas</p>
                        <p className="text-lg font-semibold text-white">{detailData.totals.absence_count}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900/40 border border-white/10">
                      <CardContent className="pt-4">
                        <p className="text-xs text-slate-300">Aulas registradas</p>
                        <p className="text-lg font-semibold text-white">{detailData.totals.entries_count}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900/40 border border-white/10">
                      <CardContent className="pt-4">
                        <p className="text-xs text-slate-300">Frequencia</p>
                        <p className="text-lg font-semibold text-white">{displayPercent(detailData.totals.attendance_percent)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-slate-900/40 border border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white text-base">Resumo por bimestre</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-[860px] w-full text-sm text-slate-100">
                          <thead>
                            <tr className="border-b border-white/10 text-slate-200">
                              <th className="text-left py-2 pr-2">Bim</th>
                              <th className="text-left py-2 pr-2">Pres.</th>
                              <th className="text-left py-2 pr-2">Falt.</th>
                              <th className="text-left py-2 pr-2">Aulas</th>
                              <th className="text-left py-2 pr-2">Nota 1</th>
                              <th className="text-left py-2 pr-2">Prova</th>
                              <th className="text-left py-2 pr-2">C5</th>
                              <th className="text-left py-2 pr-2">Nota 2</th>
                              <th className="text-left py-2 pr-2">Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.bimesters.map((bim) => (
                              <tr key={bim.bimester} className="border-b border-white/10 last:border-b-0">
                                <td className="py-2 pr-2">{bim.bimester}</td>
                                <td className="py-2 pr-2">{bim.presence_count}</td>
                                <td className="py-2 pr-2">{bim.absence_count}</td>
                                <td className="py-2 pr-2">{bim.entries_count}</td>
                                <td className="py-2 pr-2">{displayGrade(bim.note1)}</td>
                                <td className="py-2 pr-2">{displayGrade(bim.exam_score)}</td>
                                <td className="py-2 pr-2">{displayGrade(bim.c5_score)}</td>
                                <td className="py-2 pr-2">{displayGrade(bim.note2)}</td>
                                <td className="py-2 pr-2 font-semibold text-cyan-200">{displayGrade(bim.final_grade)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/40 border border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white text-base">Historico por aula</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {detailData.lessons.length === 0 ? (
                        <p className="text-sm text-slate-400">Sem historico de aulas para este ano letivo.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-[1120px] w-full text-sm text-slate-100">
                            <thead>
                              <tr className="border-b border-white/10 text-slate-200">
                                <th className="text-left py-2 pr-2">Data</th>
                                <th className="text-left py-2 pr-2">Bim</th>
                                <th className="text-left py-2 pr-2">Aula</th>
                                <th className="text-left py-2 pr-2">Presenca</th>
                                <th className="text-left py-2 pr-2">C1</th>
                                <th className="text-left py-2 pr-2">C2</th>
                                <th className="text-left py-2 pr-2">C3</th>
                                <th className="text-left py-2 pr-2">C4</th>
                                <th className="text-left py-2 pr-2">Media</th>
                                <th className="text-left py-2 pr-2">Obs.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.lessons.map((lesson) => (
                                <tr key={lesson.lesson_id} className="border-b border-white/10 last:border-b-0 odd:bg-white/[0.02]">
                                  <td className="py-2 pr-2">{formatDatePtBr(lesson.lesson_date)}</td>
                                  <td className="py-2 pr-2">{lesson.bimester}</td>
                                  <td className="py-2 pr-2">{lesson.lesson_number}</td>
                                  <td className="py-2 pr-2">
                                    {lesson.attendance === "present" ? "Presente" : lesson.attendance === "absent" ? "Falta" : "-"}
                                  </td>
                                  <td className="py-2 pr-2">{displayGrade(lesson.c1)}</td>
                                  <td className="py-2 pr-2">{displayGrade(lesson.c2)}</td>
                                  <td className="py-2 pr-2">{displayGrade(lesson.c3)}</td>
                                  <td className="py-2 pr-2">{displayGrade(lesson.c4)}</td>
                                  <td className="py-2 pr-2">{displayGrade(lesson.lesson_average)}</td>
                                  <td className="py-2 pr-2 text-slate-300 truncate max-w-[260px]">{lesson.comment || lesson.lesson_notes || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


