"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpenCheck, Eye, RefreshCcw, Search, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Teacher, TeacherLessonLog } from "@/app/types/portal"

type LessonDetailsResponse = {
  lesson_log: TeacherLessonLog
  grade_lesson: {
    id: string
    class_name: string
    has_grades?: boolean
    notes?: string | null
    observations?: string | null
  } | null
  entries: Array<{
    student_id: string
    full_name: string
    enrollment_code?: string | null
    active: boolean
    attendance?: string | null
    c1?: number | null
    c2?: number | null
    c3?: number | null
    c4?: number | null
    comment?: string | null
  }>
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("pt-BR")
}

function preview(value: string | null | undefined, max = 120) {
  const clean = String(value ?? "").trim()
  if (!clean) return "-"
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trimEnd()}...`
}

function score(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return Number(value).toFixed(2).replace(".", ",")
}

export default function TeacherLessonsClient({ teacherId }: { teacherId: string }) {
  const [loading, setLoading] = useState(true)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [logs, setLogs] = useState<TeacherLessonLog[]>([])
  const [error, setError] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsModal, setDetailsModal] = useState<LessonDetailsResponse | null>(null)

  async function loadAll() {
    setLoading(true)
    setError("")
    try {
      const [teacherRes, logsRes] = await Promise.all([
        fetch(`/api/admin/teachers/${teacherId}`, { cache: "no-store" }),
        fetch(`/api/admin/teacher-lesson-logs?teacherId=${teacherId}`, { cache: "no-store" }),
      ])

      const teacherData = await teacherRes.json().catch(() => null)
      const logsData = await logsRes.json().catch(() => [])

      setTeacher(teacherData?.id ? teacherData : null)
      setLogs(Array.isArray(logsData) ? logsData : [])
    } catch {
      setTeacher(null)
      setLogs([])
      setError("Nao foi possivel carregar os registros de aula.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId])

  const classOptions = useMemo(() => {
    const names = new Set<string>()
    for (const log of logs) {
      names.add(String(log.class_label || "Sem turma"))
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [logs])

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase()
    return logs.filter((log) => {
      const label = String(log.class_label || "Sem turma")
      if (classFilter !== "all" && label !== classFilter) return false
      if (!query) return true

      const date = formatDate(log.lesson_date).toLowerCase()
      const text = [label, date, String(log.lesson_number ?? ""), String(log.bimester ?? "")]
        .join(" ")
        .toLowerCase()
      return text.includes(query)
    })
  }, [classFilter, logs, search])

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, TeacherLessonLog[]>()
    for (const log of filteredLogs) {
      const key = String(log.class_label || "Sem turma")
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(log)
    }

    for (const [key, items] of groups.entries()) {
      items.sort((a, b) => {
        const dateDiff = String(b.lesson_date ?? "").localeCompare(String(a.lesson_date ?? ""))
        if (dateDiff !== 0) return dateDiff
        return Number(b.lesson_number ?? 0) - Number(a.lesson_number ?? 0)
      })
      groups.set(key, items)
    }

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
  }, [filteredLogs])

  async function openDetails(logId: string) {
    setDetailsLoading(true)
    setError("")
    const res = await fetch(`/api/admin/teacher-lesson-logs/${logId}/details?teacherId=${teacherId}`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => null)
    setDetailsLoading(false)

    if (!res.ok) {
      setError(String(data?.error ?? "Nao foi possivel abrir os detalhes da aula."))
      return
    }

    setDetailsModal(data as LessonDetailsResponse)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Registros de aulas</h1>
          <p className="text-sm text-slate-300">
            {teacher ? `${teacher.name} | ${teacher.email}` : "Historico completo de aulas registradas"}
          </p>
        </div>
        <Button onClick={() => void loadAll()} className="bg-white/10 hover:bg-white/15 border border-white/10" disabled={loading}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="bg-slate-900/30 backdrop-blur-sm border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-300" />
            Filtro de turmas/aulas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-[240px,1fr,auto] gap-3">
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className="rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
          >
            <option value="all">Todas as turmas</option>
            {classOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por aula, bimestre, data ou turma"
            className="rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
          />
          <Button
            type="button"
            onClick={() => {
              setSearch("")
              setClassFilter("all")
            }}
            className="bg-white/10 hover:bg-white/15 border border-white/10"
            disabled={!search.trim() && classFilter === "all"}
          >
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/30 backdrop-blur-sm border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <BookOpenCheck className="w-4 h-4 text-cyan-300" />
            Turmas e aulas ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-rose-300 mb-3">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-slate-400">Carregando aulas...</p>
          ) : groupedLogs.length === 0 ? (
            <p className="text-sm text-slate-400">Sem registros para os filtros escolhidos.</p>
          ) : (
            <div className="space-y-4">
              {groupedLogs.map(([classLabel, items]) => (
                <details key={classLabel} className="rounded-xl border border-white/10 bg-white/5">
                  <summary className="cursor-pointer list-none px-4 py-3 border-b border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{classLabel}</p>
                        <p className="text-xs text-slate-300">{items.length} aulas registradas</p>
                      </div>
                    </div>
                  </summary>
                  <div className="space-y-2 p-3">
                    {items.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-cyan-100">
                              Aula {log.lesson_number}
                            </span>
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/80">
                              B{log.bimester ?? "-"}
                            </span>
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/80">
                              {formatDate(log.lesson_date)}
                            </span>
                            {log.has_grades === false ? (
                              <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                                Sem nota
                              </span>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            onClick={() => void openDetails(log.id)}
                            className="h-8 bg-white/10 hover:bg-white/15 border border-white/10"
                          >
                            <Eye className="w-4 h-4 mr-1.5" />
                            Detalhes
                          </Button>
                        </div>
                        <p className="text-xs text-slate-300 mt-2">Diario: {preview(log.notes)}</p>
                        <p className="text-xs text-slate-400 mt-1">Observacoes: {preview(log.observations)}</p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {detailsLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
          <Card className="relative z-10 w-full max-w-md bg-slate-900/95 border border-white/10 text-white">
            <CardContent className="py-8">
              <p className="text-center text-sm text-slate-200">Carregando detalhes da aula...</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {detailsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
          <button
            type="button"
            onClick={() => setDetailsModal(null)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label="Fechar"
          />
          <Card className="relative z-10 w-full max-w-6xl max-h-[92vh] overflow-hidden bg-slate-900/95 border border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>
                  {detailsModal.lesson_log.class_label} | Aula {detailsModal.lesson_log.lesson_number} | B
                  {detailsModal.lesson_log.bimester ?? "-"}
                </span>
                <Button
                  type="button"
                  onClick={() => setDetailsModal(null)}
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
                  <p className="text-xs text-slate-300">Data</p>
                  <p className="text-sm text-white">{formatDate(detailsModal.lesson_log.lesson_date)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">Tipo</p>
                  <p className="text-sm text-white">{detailsModal.lesson_log.has_grades === false ? "Sem nota" : "Com nota"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">Alunos na aula</p>
                  <p className="text-sm text-white">{detailsModal.entries.length}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">ID registro</p>
                  <p className="text-sm text-white">#{String(detailsModal.lesson_log.id).slice(0, 8)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap">
                <p className="text-xs text-slate-300 mb-1">Diario da aula</p>
                <p>{String(detailsModal.lesson_log.notes ?? "").trim() || "-"}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap">
                <p className="text-xs text-slate-300 mb-1">Observacoes</p>
                <p>{String(detailsModal.lesson_log.observations ?? "").trim() || "-"}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-x-auto">
                <table className="min-w-[880px] w-full text-sm">
                  <thead>
                    <tr className="text-slate-300 border-b border-white/10">
                      <th className="text-left py-2 px-3">Aluno</th>
                      <th className="text-left py-2 px-2">Presenca</th>
                      <th className="text-left py-2 px-2">C1</th>
                      <th className="text-left py-2 px-2">C2</th>
                      <th className="text-left py-2 px-2">C3</th>
                      <th className="text-left py-2 px-2">C4</th>
                      <th className="text-left py-2 px-2">Media aula</th>
                      <th className="text-left py-2 px-2">Observacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailsModal.entries.map((entry) => {
                      const c1 = entry.c1 === null || entry.c1 === undefined ? null : Number(entry.c1)
                      const c2 = entry.c2 === null || entry.c2 === undefined ? null : Number(entry.c2)
                      const c3 = entry.c3 === null || entry.c3 === undefined ? null : Number(entry.c3)
                      const c4 = entry.c4 === null || entry.c4 === undefined ? null : Number(entry.c4)
                      const avg =
                        c1 !== null && c2 !== null && c3 !== null && c4 !== null
                          ? (c1 + c2 + c3 + c4) / 4
                          : null

                      return (
                        <tr key={entry.student_id} className="border-b border-white/10 last:border-b-0">
                          <td className="py-2 px-3 text-white">
                            <div className="flex items-center gap-2">
                              <span>{entry.full_name}</span>
                              {!entry.active ? (
                                <span className="text-[10px] rounded-full border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 text-rose-200">
                                  Inativo
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-white/85">
                            {entry.attendance === "absent" ? "Falta" : entry.attendance === "present" ? "Presenca" : "-"}
                          </td>
                          <td className="py-2 px-2 text-white/85">{score(c1)}</td>
                          <td className="py-2 px-2 text-white/85">{score(c2)}</td>
                          <td className="py-2 px-2 text-white/85">{score(c3)}</td>
                          <td className="py-2 px-2 text-white/85">{score(c4)}</td>
                          <td className="py-2 px-2 text-white/85">{score(avg)}</td>
                          <td className="py-2 px-2 text-white/75">{String(entry.comment ?? "").trim() || "-"}</td>
                        </tr>
                      )
                    })}
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
