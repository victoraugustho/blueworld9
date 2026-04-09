"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ClipboardCheck, Plus, RefreshCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TeacherClass, TeacherGradeLesson, TeacherGradeLessonEntry } from "@/app/types/portal"
import { formatDatePtBr } from "@/lib/format-date"
import { getTurmaYearLabel } from "@/lib/turma-years"
import NotasSectionNav from "../_components/NotasSectionNav"

type Locale = "pt-BR" | "es"

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeLessonDate(value: string) {
  const raw = String(value ?? "").trim()
  if (!raw) return todayIsoDate()

  const justDate = raw.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (justDate) return justDate[1]

  const isoWithTime = raw.match(/^(\d{4}-\d{2}-\d{2})T/)
  if (isoWithTime) return isoWithTime[1]

  return todayIsoDate()
}

function parseNumericInput(value: string, max = 10) {
  const clean = value.replace(",", ".").trim()
  if (!clean) return null
  const n = Number(clean)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(max, Math.round(n * 100) / 100))
}

const scoreInputClass =
  "h-7 w-14 md:w-16 bg-slate-800/80 border-slate-700 text-white text-center text-xs px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

export default function LancamentosClient({ locale }: { locale: Locale }) {
  const isEs = locale === "es"
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear())
  const [bimester, setBimester] = useState(1)

  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [lessons, setLessons] = useState<TeacherGradeLesson[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState("")
  const [entries, setEntries] = useState<TeacherGradeLessonEntry[]>([])
  const [lessonDate, setLessonDate] = useState(todayIsoDate())
  const [lessonNotes, setLessonNotes] = useState("")

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  )

  const selectedLesson = useMemo(
    () => lessons.find((item) => item.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  )

  async function loadClasses(targetYear = schoolYear) {
    const res = await fetch(`/api/portal/gradebook/classes?schoolYear=${targetYear}`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => [])
    const list: TeacherClass[] = Array.isArray(data) ? data : []
    setClasses(list)
    setSelectedClassId((prev) => {
      if (prev && list.some((item) => item.id === prev)) return prev
      return list[0]?.id ?? ""
    })
  }

  async function loadLessons(classId: string) {
    if (!classId) {
      setLessons([])
      setSelectedLessonId("")
      return
    }
    const res = await fetch(
      `/api/portal/gradebook/lessons?classId=${classId}&bimester=${bimester}&schoolYear=${schoolYear}`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => [])
    const list: TeacherGradeLesson[] = Array.isArray(data) ? data : []
    setLessons(list)
    setSelectedLessonId((prev) => {
      if (prev && list.some((item) => item.id === prev)) return prev
      return list[0]?.id ?? ""
    })
  }

  async function loadLessonDetail(lessonId: string) {
    if (!lessonId) {
      setEntries([])
      setLessonDate(todayIsoDate())
      setLessonNotes("")
      return
    }
    const res = await fetch(`/api/portal/gradebook/lessons/${lessonId}`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    setEntries(Array.isArray(data?.entries) ? data.entries : [])
    setLessonDate(normalizeLessonDate(String(data?.lesson?.lesson_date ?? "")))
    setLessonNotes(String(data?.lesson?.notes ?? ""))
  }

  async function refreshAll() {
    setSyncing(true)
    setError("")
    try {
      await loadClasses(schoolYear)
    } catch {
      setError(isEs ? "Error al actualizar." : "Erro ao atualizar.")
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    loadClasses(schoolYear)
      .catch(() => {
        if (active) setError(isEs ? "Error al cargar datos." : "Erro ao carregar dados.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loading) return
    loadClasses(schoolYear).catch(() => setError(isEs ? "Error al cargar turmas." : "Erro ao carregar turmas."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear])

  useEffect(() => {
    if (loading) return
    loadLessons(selectedClassId).catch(() => setError(isEs ? "Error al cargar clases." : "Erro ao carregar aulas."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, bimester, schoolYear, loading])

  useEffect(() => {
    if (loading) return
    loadLessonDetail(selectedLessonId).catch(() =>
      setError(isEs ? "Error al cargar la clase." : "Erro ao carregar a aula."),
    )
  }, [selectedLessonId, loading, isEs])

  async function createLesson() {
    if (!selectedClassId) return
    const safeDate = normalizeLessonDate(lessonDate)
    if (safeDate !== lessonDate) setLessonDate(safeDate)

    setSaving(true)
    setError("")
    const res = await fetch("/api/portal/gradebook/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: selectedClassId,
        bimester,
        school_year: schoolYear,
        lesson_date: safeDate,
        notes: lessonNotes,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(String(data?.error ?? (isEs ? "No se pudo crear la clase." : "Nao foi possivel criar a aula.")))
      return
    }

    const created = await res.json().catch(() => null)
    await loadLessons(selectedClassId)
    if (created?.id) setSelectedLessonId(created.id)
  }

  function updateEntry(studentId: string, patch: Partial<TeacherGradeLessonEntry>) {
    setEntries((prev) =>
      prev.map((item) => (item.student_id === studentId ? { ...item, ...patch } : item)),
    )
  }

  function clampEntryScore(studentId: string, field: "c1" | "c2" | "c3" | "c4", max = 10) {
    setEntries((prev) =>
      prev.map((item) => {
        if (item.student_id !== studentId) return item
        const current = item[field]
        if (current === null || current === undefined) return item
        const clamped = parseNumericInput(String(current), max)
        if (clamped === current) return item
        return { ...item, [field]: clamped }
      }),
    )
  }

  async function saveLesson() {
    if (!selectedLessonId) return
    const safeDate = normalizeLessonDate(lessonDate)
    if (safeDate !== lessonDate) setLessonDate(safeDate)

    setSaving(true)
    setError("")
    const res = await fetch(`/api/portal/gradebook/lessons/${selectedLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson_date: safeDate,
        notes: lessonNotes,
        entries: entries.map((item) => ({
          student_id: item.student_id,
          attendance: item.attendance,
          c1: item.c1 ?? null,
          c2: item.c2 ?? null,
          c3: item.c3 ?? null,
          c4: item.c4 ?? null,
          comment: item.comment ?? null,
        })),
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(String(data?.error ?? (isEs ? "No se pudo guardar." : "Nao foi possivel salvar.")))
      return
    }

    await loadLessons(selectedClassId)
    await loadLessonDetail(selectedLessonId)
  }

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-amber-300" />
          {isEs ? "Lanzamiento por Clase" : "Lancamento por Aula"}
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          {isEs
            ? "Pagina exclusiva para registrar asistencia y C1..C4."
            : "Pagina exclusiva para registrar presenca e C1..C4."}
        </p>
      </div>

      <NotasSectionNav locale={locale} />

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-white">{isEs ? "Ano lectivo" : "Ano letivo"}</Label>
              <Input
                type="number"
                value={schoolYear}
                onChange={(e) => setSchoolYear(Number(e.target.value || new Date().getFullYear()))}
                className="mt-1 bg-slate-800/70 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-white">{isEs ? "Bimestre" : "Bimestre"}</Label>
              <select
                value={bimester}
                onChange={(e) => setBimester(Number(e.target.value))}
                className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-white">{isEs ? "Turma" : "Turma"}</Label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
              >
                <option value="">{isEs ? "Sin turma" : "Sem turma"}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.student_year ? `• ${getTurmaYearLabel(item.student_year)}` : ""} • #{item.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:self-end">
              <Button onClick={refreshAll} disabled={syncing} className="w-full bg-white/10 hover:bg-white/15 border border-white/10">
                <RefreshCcw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {isEs ? "Actualizar" : "Atualizar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClass ? (
        <div className="grid grid-cols-1 xl:grid-cols-[280px,1fr] gap-4">
          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">{isEs ? "Clases del bimestre" : "Aulas do bimestre"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-white">{isEs ? "Fecha de la clase" : "Data da aula"}</Label>
                <Input
                  type="date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  onBlur={() => {
                    if (!String(lessonDate ?? "").trim()) {
                      setLessonDate(todayIsoDate())
                    }
                  }}
                  className="bg-slate-800/70 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">{isEs ? "Observaciones" : "Observacoes"}</Label>
                <Input
                  value={lessonNotes}
                  onChange={(e) => setLessonNotes(e.target.value)}
                  className="bg-slate-800/70 border-slate-700 text-white"
                />
              </div>
              <Button onClick={createLesson} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700">
                <Plus className="w-4 h-4 mr-2" />
                {isEs ? "Crear clase" : "Criar aula"}
              </Button>

              <div className="rounded-lg border border-white/10 overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  {lessons.map((lesson) => {
                    const active = lesson.id === selectedLessonId
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => setSelectedLessonId(lesson.id)}
                        className={`w-full text-left px-3 py-3 border-b border-white/10 last:border-b-0 transition ${
                          active ? "bg-cyan-500/20" : "hover:bg-white/5"
                        }`}
                      >
                        <p className="text-sm font-semibold text-white">
                          {isEs ? "Clase" : "Aula"} {lesson.lesson_number}
                        </p>
                        <p className="text-xs text-slate-300">{formatDatePtBr(lesson.lesson_date)}</p>
                      </button>
                    )
                  })}
                  {lessons.length === 0 ? (
                    <p className="p-3 text-sm text-slate-400">
                      {isEs ? "Sin clases en este bimestre." : "Sem aulas neste bimestre."}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>
                  {isEs ? "Lanzamiento" : "Lancamento"} {selectedLesson ? `• ${isEs ? "Clase" : "Aula"} ${selectedLesson.lesson_number}` : ""}
                </span>
                {selectedLessonId ? (
                  <Link
                    href={`/portal/dashboard/notas/aulas/${selectedLessonId}`}
                    className="text-sm text-cyan-300 hover:text-cyan-200"
                  >
                    {isEs ? "Abrir clase" : "Abrir aula"}
                  </Link>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedLessonId ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-[760px] md:min-w-[820px] w-full text-sm">
                      <thead>
                        <tr className="text-slate-300 border-b border-white/10">
                          <th className="text-left py-2 pr-1">{isEs ? "Alumno" : "Aluno"}</th>
                          <th className="text-left py-2 pr-1">{isEs ? "Asistencia" : "Presenca"}</th>
                          <th className="text-left py-2 pr-1">C1</th>
                          <th className="text-left py-2 pr-1">C2</th>
                          <th className="text-left py-2 pr-1">C3</th>
                          <th className="text-left py-2 pr-1">C4</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.student_id} className="border-b border-white/10 last:border-b-0">
                            <td className="py-2 pr-1 text-white max-w-[220px] truncate">{entry.full_name}</td>
                            <td className="py-2 pr-1">
                              <label className="inline-flex items-center text-sm text-slate-100">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-cyan-500 cursor-pointer"
                                  checked={entry.attendance !== "absent"}
                                  onChange={(e) =>
                                    updateEntry(entry.student_id, {
                                      attendance: e.target.checked ? "present" : "absent",
                                    })
                                  }
                                />
                              </label>
                            </td>
                            <td className="py-2 pr-1">
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                step={0.01}
                                value={entry.c1 ?? ""}
                                onChange={(e) => updateEntry(entry.student_id, { c1: parseNumericInput(e.target.value, 10) })}
                                onBlur={() => clampEntryScore(entry.student_id, "c1", 10)}
                                className={scoreInputClass}
                              />
                            </td>
                            <td className="py-2 pr-1">
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                step={0.01}
                                value={entry.c2 ?? ""}
                                onChange={(e) => updateEntry(entry.student_id, { c2: parseNumericInput(e.target.value, 10) })}
                                onBlur={() => clampEntryScore(entry.student_id, "c2", 10)}
                                className={scoreInputClass}
                              />
                            </td>
                            <td className="py-2 pr-1">
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                step={0.01}
                                value={entry.c3 ?? ""}
                                onChange={(e) => updateEntry(entry.student_id, { c3: parseNumericInput(e.target.value, 10) })}
                                onBlur={() => clampEntryScore(entry.student_id, "c3", 10)}
                                className={scoreInputClass}
                              />
                            </td>
                            <td className="py-2 pr-1">
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                step={0.01}
                                value={entry.c4 ?? ""}
                                onChange={(e) => updateEntry(entry.student_id, { c4: parseNumericInput(e.target.value, 10) })}
                                onBlur={() => clampEntryScore(entry.student_id, "c4", 10)}
                                className={scoreInputClass}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button onClick={saveLesson} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
                    <Save className="w-4 h-4 mr-2" />
                    {isEs ? "Guardar lanzamiento" : "Salvar lancamento"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-slate-400">{isEs ? "Seleccione una clase." : "Selecione uma aula."}</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-400">
              {isEs ? "Seleccione una turma para comenzar." : "Selecione uma turma para comecar."}
            </p>
          </CardContent>
        </Card>
      )}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

