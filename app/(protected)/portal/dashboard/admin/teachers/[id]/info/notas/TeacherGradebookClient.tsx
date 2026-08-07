"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Eye, GraduationCap, Lock, LockOpen, RefreshCcw, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Teacher } from "@/app/types/portal"
import { getTurmaYearLabel } from "@/lib/turma-years"

type GradebookStudent = {
  student_id: string
  full_name: string
  active: boolean
  entries_count: number
  presence_count: number
  absence_count: number
  attendance_percent?: number | null
  b1_final_grade?: number | null
  b2_final_grade?: number | null
  b3_final_grade?: number | null
  b4_final_grade?: number | null
}

type GradebookClassBimester = {
  bimester: number
  students_with_final: number
  total_students: number
  closed: boolean
}

type GradebookClass = {
  id: string
  name: string
  student_year?: number | null
  school_year: number
  active: boolean
  student_count: number
  active_student_count: number
  lesson_count: number
  last_lesson_date?: string | null
  last_lesson_number?: number | null
  students: GradebookStudent[]
  bimesters: GradebookClassBimester[]
}

type GradebookOverview = {
  school_year: number
  class_count: number
  active_class_count: number
  student_count: number
  active_student_count: number
  lesson_count: number
}

type GradebookRecentLesson = {
  id: string
  class_name: string
  bimester: number
  lesson_number: number
  lesson_date?: string | null
  entries_count: number
  absences_count: number
}

type TeacherInsights = {
  gradebook?: {
    school_year: number
    overview: GradebookOverview
    classes: GradebookClass[]
    recent_lessons: GradebookRecentLesson[]
  }
}

type PendingCloseReport = {
  context: {
    class_id: string
    class_name: string
    school_year: number
    bimester: number
  }
  pending: {
    lesson_entries: Array<{
      student_id: string
      full_name: string
      lesson_id: string
      lesson_number: number
      lesson_date: string
      missing_fields: string[]
    }>
    note2: Array<{
      student_id: string
      full_name: string
      missing_exam_score: boolean
      missing_c5_score: boolean
    }>
    final_grades: Array<{
      student_id: string
      full_name: string
    }>
  }
}

type StudentInsightModalData = {
  class: {
    id: string
    name: string
    school_year: number
    student_year: number | null
    active: boolean
  }
  student: {
    id: string
    full_name: string
    enrollment_code: string | null
    active: boolean
    created_at: string | null
    updated_at: string | null
  }
  totals: {
    entries_count: number
    presence_count: number
    absence_count: number
    attendance_percent: number | null
  }
  bimesters: Array<{
    bimester: number
    entries_count: number
    graded_lessons: number
    presence_count: number
    absence_count: number
    note1: number | null
    has_exam: boolean
    exam_score: number | null
    c5_score: number | null
    manual_final_score: number | null
    note2: number | null
    final_grade: number | null
    notes: string | null
    updated_at: string | null
  }>
  lessons: Array<{
    lesson_id: string
    bimester: number
    lesson_number: number
    lesson_date: string
    lesson_notes: string | null
    attendance: "present" | "absent" | null
    c1: number | null
    c2: number | null
    c3: number | null
    c4: number | null
    lesson_average: number | null
    comment: string | null
    updated_at: string | null
  }>
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("pt-BR")
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return Number(value).toFixed(2).replace(".", ",")
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return `${Number(value).toFixed(1).replace(".", ",")}%`
}

export default function TeacherGradebookClient({ teacherId }: { teacherId: string }) {
  const [loading, setLoading] = useState(true)
  const [lockSavingKey, setLockSavingKey] = useState("")
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [insights, setInsights] = useState<TeacherInsights | null>(null)
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({})
  const [error, setError] = useState("")
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false)
  const [studentDetailsModal, setStudentDetailsModal] = useState<StudentInsightModalData | null>(null)
  const [pendingCloseReport, setPendingCloseReport] = useState<PendingCloseReport | null>(null)
  const [forceClosing, setForceClosing] = useState(false)
  const [classSearch, setClassSearch] = useState("")

  async function loadAll() {
    setLoading(true)
    setError("")
    try {
      const [teacherRes, insightsRes] = await Promise.all([
        fetch(`/api/admin/teachers/${teacherId}`, { cache: "no-store" }),
        fetch(`/api/admin/teachers/${teacherId}/insights`, { cache: "no-store" }),
      ])

      const teacherData = await teacherRes.json().catch(() => null)
      const insightsData = await insightsRes.json().catch(() => null)

      setTeacher(teacherData?.id ? teacherData : null)
      setInsights(insightsData ?? null)
    } catch {
      setTeacher(null)
      setInsights(null)
      setError("Nao foi possivel carregar os dados de turmas e notas.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId])

  const gradebook = insights?.gradebook

  useEffect(() => {
    if (!gradebook?.classes?.length) {
      setOpenClasses({})
      return
    }
    setOpenClasses((prev) => {
      const next: Record<string, boolean> = {}
      for (const item of gradebook.classes) {
        next[item.id] = prev[item.id] ?? false
      }
      return next
    })
  }, [gradebook?.classes])

  const summary = useMemo(() => {
    if (!gradebook?.overview) {
      return {
        class_count: 0,
        active_class_count: 0,
        student_count: 0,
        active_student_count: 0,
        lesson_count: 0,
      }
    }
    return gradebook.overview
  }, [gradebook])

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase()
    if (!query) return gradebook?.classes ?? []
    return (gradebook?.classes ?? []).filter((item) => {
      const yearLabel =
        item.student_year === null || item.student_year === undefined
          ? "sem ano"
          : getTurmaYearLabel(Number(item.student_year)).toLowerCase()
      const text = `${item.name} ${item.school_year} ${yearLabel} ${item.id}`.toLowerCase()
      return text.includes(query)
    })
  }, [classSearch, gradebook?.classes])

  function toggleClass(classId: string) {
    setOpenClasses((prev) => ({ ...prev, [classId]: !prev[classId] }))
  }

  async function openStudentDetails(classId: string, studentId: string, schoolYear: number) {
    if (!classId || !studentId) return

    setStudentDetailsLoading(true)
    setError("")
    const res = await fetch(
      `/api/portal/gradebook/classes/${classId}/students/${studentId}/insights?schoolYear=${schoolYear}`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => null)
    setStudentDetailsLoading(false)

    if (!res.ok) {
      setError(String(data?.error ?? "Nao foi possivel carregar detalhes do aluno."))
      return
    }

    setStudentDetailsModal(data as StudentInsightModalData)
  }

  async function toggleBimesterLock(item: GradebookClass, bim: GradebookClassBimester) {
    const key = `${item.id}:${item.school_year}:${bim.bimester}`
    setLockSavingKey(key)
    setError("")

    const method = bim.closed ? "DELETE" : "POST"
    const res = await fetch("/api/portal/gradebook/bimester-lock", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: item.id,
        school_year: item.school_year,
        bimester: bim.bimester,
      }),
    })
    const data = await res.json().catch(() => null)
    setLockSavingKey("")

    if (res.status === 409 && data?.requires_force_confirmation) {
      setPendingCloseReport(data as PendingCloseReport)
      return
    }

    if (!res.ok) {
      setError(String(data?.error ?? "Nao foi possivel alterar o status do bimestre."))
      return
    }

    await loadAll()
  }

  async function confirmForcedClose() {
    if (!pendingCloseReport || forceClosing) return
    setForceClosing(true)
    setError("")

    const res = await fetch("/api/portal/gradebook/bimester-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: pendingCloseReport.context.class_id,
        school_year: pendingCloseReport.context.school_year,
        bimester: pendingCloseReport.context.bimester,
        force_close: true,
      }),
    })
    const data = await res.json().catch(() => null)
    setForceClosing(false)

    if (!res.ok) {
      setError(String(data?.error ?? "Nao foi possivel fechar o bimestre."))
      return
    }

    setPendingCloseReport(null)
    await loadAll()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Turmas e notas</h1>
          <p className="text-sm text-slate-300">
            {teacher ? `${teacher.name} | ${teacher.email}` : "Visao de notas, alunos e fechamento por turma"}
          </p>
        </div>
        <Button onClick={() => void loadAll()} className="bg-white/10 hover:bg-white/15 border border-white/10" disabled={loading}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-300 uppercase tracking-wide">Turmas</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.class_count}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-300 uppercase tracking-wide">Turmas ativas</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.active_class_count}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-300 uppercase tracking-wide">Alunos</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.student_count}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-300 uppercase tracking-wide">Alunos ativos</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.active_student_count}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-300 uppercase tracking-wide">Aulas</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.lesson_count}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-cyan-300" />
            Turmas da grade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            value={classSearch}
            onChange={(event) => setClassSearch(event.target.value)}
            placeholder="Buscar turma por nome, ano ou ID"
            className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
          />

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          {!gradebook?.classes?.length ? (
            <p className="text-sm text-slate-400">Nenhuma turma encontrada para o ano atual.</p>
          ) : filteredClasses.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma turma encontrada para o filtro informado.</p>
          ) : (
            <div className="space-y-3">
              {filteredClasses.map((item) => {
                const isOpen = openClasses[item.id] === true
                const yearLabel =
                  item.student_year === null || item.student_year === undefined
                    ? "Sem ano"
                    : getTurmaYearLabel(Number(item.student_year))

                return (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleClass(item.id)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                        <p className="text-xs text-white/70">
                          {yearLabel} | {item.school_year} | ID #{item.id.slice(0, 8)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] rounded-full border border-white/20 bg-white/10 px-2 py-1 text-white/80">
                          {item.active_student_count}/{item.student_count} ativos
                        </span>
                        <span className="text-[11px] rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-1 text-cyan-100">
                          {item.lesson_count} aulas
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-white/70" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-white/70" />
                        )}
                      </div>
                    </button>

                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {item.bimesters.map((bim) => {
                          const key = `${item.id}:${item.school_year}:${bim.bimester}`
                          const isSaving = lockSavingKey === key
                          return (
                            <div
                              key={`${item.id}-${bim.bimester}`}
                              className={`text-[11px] rounded-lg border px-2 py-1.5 flex items-center gap-2 ${
                                bim.closed
                                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-100"
                                  : "border-amber-500/30 bg-amber-500/15 text-amber-100"
                              }`}
                            >
                              <span>
                                B{bim.bimester}: {bim.students_with_final}/{bim.total_students} finais{" "}
                                {bim.closed ? "(fechado)" : "(aberto)"}
                              </span>
                              <Button
                                type="button"
                                onClick={() => void toggleBimesterLock(item, bim)}
                                disabled={isSaving}
                                className={`h-6 px-2 text-[10px] ${
                                  bim.closed
                                    ? "bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-300/30"
                                    : "bg-amber-700/40 hover:bg-amber-700/60 border border-amber-300/30"
                                }`}
                              >
                                {bim.closed ? (
                                  <LockOpen className="w-3 h-3 mr-1" />
                                ) : (
                                  <Lock className="w-3 h-3 mr-1" />
                                )}
                                {isSaving ? "Aguarde..." : bim.closed ? "Reabrir" : "Fechar"}
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                      {item.last_lesson_date ? (
                        <p className="text-[11px] text-white/60 mt-2">
                          Ultima aula: {formatDate(item.last_lesson_date)}
                          {item.last_lesson_number ? ` | Aula ${item.last_lesson_number}` : ""}
                        </p>
                      ) : null}
                    </div>

                    {isOpen ? (
                      <div className="border-t border-white/10 p-3 overflow-x-auto">
                        {item.students.length === 0 ? (
                          <p className="text-sm text-slate-400">Sem alunos nesta turma.</p>
                        ) : (
                          <table className="min-w-[940px] w-full text-sm">
                            <thead>
                              <tr className="text-white/65 text-xs border-b border-white/10">
                                <th className="text-left py-2 pr-2">Aluno</th>
                                <th className="text-right py-2 px-2">Pres.</th>
                                <th className="text-right py-2 px-2">Falt.</th>
                                <th className="text-right py-2 px-2">Freq.</th>
                                <th className="text-right py-2 px-2">B1</th>
                                <th className="text-right py-2 px-2">B2</th>
                                <th className="text-right py-2 px-2">B3</th>
                                <th className="text-right py-2 px-2">B4</th>
                                <th className="text-center py-2 pl-2">Detalhes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.students.map((student) => (
                                <tr key={student.student_id} className="border-b border-white/5 text-white/85">
                                  <td className="py-2 pr-2">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate">{student.full_name}</span>
                                      {!student.active ? (
                                        <span className="text-[10px] rounded-full border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 text-rose-200">
                                          Inativo
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 text-right">{student.presence_count}</td>
                                  <td className="py-2 px-2 text-right">{student.absence_count}</td>
                                  <td className="py-2 px-2 text-right">{formatPercent(student.attendance_percent)}</td>
                                  <td className="py-2 px-2 text-right">{formatScore(student.b1_final_grade)}</td>
                                  <td className="py-2 px-2 text-right">{formatScore(student.b2_final_grade)}</td>
                                  <td className="py-2 px-2 text-right">{formatScore(student.b3_final_grade)}</td>
                                  <td className="py-2 px-2 text-right">{formatScore(student.b4_final_grade)}</td>
                                  <td className="py-2 pl-2 text-center">
                                    <Button
                                      type="button"
                                      onClick={() =>
                                        void openStudentDetails(item.id, student.student_id, item.school_year)
                                      }
                                      className="h-8 bg-white/10 hover:bg-white/15 border border-white/10"
                                    >
                                      <Eye className="w-4 h-4 mr-1.5" />
                                      Detalhes
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white text-base">Aulas recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {!gradebook?.recent_lessons?.length ? (
            <p className="text-sm text-slate-400">Nenhum lancamento recente.</p>
          ) : (
            <div className="space-y-2">
              {gradebook.recent_lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">
                      {lesson.class_name} | B{lesson.bimester} | Aula {lesson.lesson_number}
                    </p>
                    <p className="text-xs text-slate-300">
                      {formatDate(lesson.lesson_date)} | {lesson.entries_count} lancamentos | {lesson.absences_count} faltas
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingCloseReport ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-4">
          <button
            type="button"
            onClick={() => {
              if (!forceClosing) setPendingCloseReport(null)
            }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-label="Cancelar fechamento"
          />
          <Card className="relative z-10 w-full max-w-4xl max-h-[92vh] overflow-hidden bg-slate-900/95 border border-amber-400/30 text-white shadow-2xl">
            <CardHeader className="border-b border-amber-400/20 bg-amber-500/10">
              <CardTitle className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-amber-200">Existem pendências neste bimestre</p>
                  <p className="mt-1 text-sm font-normal text-slate-300">
                    {pendingCloseReport.context.class_name} | {pendingCloseReport.context.school_year} | B{pendingCloseReport.context.bimester}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setPendingCloseReport(null)}
                  disabled={forceClosing}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(92vh-92px)] overflow-y-auto space-y-5 pt-4">
              <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                Se continuar, o bimestre será fechado mesmo com os itens abaixo incompletos. O professor não poderá alterar esses lançamentos enquanto o bimestre estiver fechado.
              </p>

              {pendingCloseReport.pending.lesson_entries.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="font-semibold text-white">
                    Aulas com notas ou presença pendentes ({pendingCloseReport.pending.lesson_entries.length})
                  </h3>
                  <div className="rounded-lg border border-white/10 bg-slate-950/40 divide-y divide-white/10">
                    {pendingCloseReport.pending.lesson_entries.map((item) => (
                      <div key={`${item.student_id}:${item.lesson_id}`} className="p-3 text-sm">
                        <p className="font-medium text-white">{item.full_name}</p>
                        <p className="text-slate-300">
                          Aula {item.lesson_number} ({formatDate(item.lesson_date)}) — faltando: {item.missing_fields.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {pendingCloseReport.pending.note2.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="font-semibold text-white">
                    Prova/Atividade ou C5 pendentes ({pendingCloseReport.pending.note2.length})
                  </h3>
                  <div className="rounded-lg border border-white/10 bg-slate-950/40 divide-y divide-white/10">
                    {pendingCloseReport.pending.note2.map((item) => {
                      const fields = [
                        item.missing_exam_score ? "Prova/Atividade" : null,
                        item.missing_c5_score ? "C5" : null,
                      ].filter(Boolean)
                      return (
                        <div key={item.student_id} className="p-3 text-sm">
                          <span className="font-medium text-white">{item.full_name}</span>
                          <span className="text-slate-300"> — faltando: {fields.join(", ")}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}

              {pendingCloseReport.pending.final_grades.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="font-semibold text-white">
                    Nota final não calculada ({pendingCloseReport.pending.final_grades.length})
                  </h3>
                  <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
                    {pendingCloseReport.pending.final_grades.map((item) => item.full_name).join(", ")}
                  </div>
                </section>
              ) : null}

              <div className="sticky bottom-0 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-white/10 bg-slate-900/95 pt-4 pb-1">
                <Button
                  type="button"
                  onClick={() => setPendingCloseReport(null)}
                  disabled={forceClosing}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  Cancelar e revisar notas
                </Button>
                <Button
                  type="button"
                  onClick={() => void confirmForcedClose()}
                  disabled={forceClosing}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {forceClosing ? "Fechando..." : "Confirmar fechamento mesmo assim"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {studentDetailsLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
          <Card className="relative z-10 w-full max-w-md bg-slate-900/95 border border-white/10 text-white">
            <CardContent className="py-8">
              <p className="text-center text-sm text-slate-200">Carregando detalhes do aluno...</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {studentDetailsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
          <button
            type="button"
            onClick={() => setStudentDetailsModal(null)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label="Fechar"
          />
          <Card className="relative z-10 w-full max-w-6xl max-h-[92vh] overflow-hidden bg-slate-900/95 border border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{studentDetailsModal.student.full_name} | Detalhes</span>
                <Button
                  type="button"
                  onClick={() => setStudentDetailsModal(null)}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Fechar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(92vh-78px)] space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">Turma</p>
                  <p className="text-sm text-white">{studentDetailsModal.class.name}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">Ano letivo</p>
                  <p className="text-sm text-white">{studentDetailsModal.class.school_year}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">Presencas</p>
                  <p className="text-sm text-white">{studentDetailsModal.totals.presence_count}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">Frequencia</p>
                  <p className="text-sm text-white">
                    {studentDetailsModal.totals.attendance_percent === null
                      ? "-"
                      : `${Number(studentDetailsModal.totals.attendance_percent).toFixed(2)}%`}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-x-auto">
                <table className="min-w-[860px] w-full text-sm">
                  <thead>
                    <tr className="text-slate-300 border-b border-white/10">
                      <th className="text-left py-2 px-3">Bimestre</th>
                      <th className="text-left py-2 px-2">Aulas</th>
                      <th className="text-left py-2 px-2">Nota 1</th>
                      <th className="text-left py-2 px-2">Prova/Atividade</th>
                      <th className="text-left py-2 px-2">C5</th>
                      <th className="text-left py-2 px-2">Nota 2</th>
                      <th className="text-left py-2 px-2">Final</th>
                      <th className="text-left py-2 px-2">Observacoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentDetailsModal.bimesters.map((item) => (
                      <tr key={item.bimester} className="border-b border-white/10 last:border-b-0">
                        <td className="py-2 px-3">B{item.bimester}</td>
                        <td className="py-2 px-2">{item.graded_lessons}</td>
                        <td className="py-2 px-2">{formatScore(item.note1)}</td>
                        <td className="py-2 px-2">{formatScore(item.exam_score)}</td>
                        <td className="py-2 px-2">{formatScore(item.c5_score)}</td>
                        <td className="py-2 px-2">{formatScore(item.note2)}</td>
                        <td className="py-2 px-2">{formatScore(item.final_grade)}</td>
                        <td className="py-2 px-2">{String(item.notes ?? "").trim() || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
