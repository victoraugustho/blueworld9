"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TeacherGradeLesson, TeacherGradeLessonEntry } from "@/app/types/portal"
import NotasSectionNav from "../../_components/NotasSectionNav"

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

type ScoreField = "c1" | "c2" | "c3" | "c4"
const scoreFieldOrder: ScoreField[] = ["c1", "c2", "c3", "c4"]

export default function AulaDetalheClient({
  locale,
  lessonId,
  canDeleteLesson,
  scoreMax = 10,
}: {
  locale: Locale
  lessonId: string
  canDeleteLesson: boolean
  scoreMax?: number
}) {
  const router = useRouter()
  const isEs = locale === "es"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [lesson, setLesson] = useState<TeacherGradeLesson | null>(null)
  const [entries, setEntries] = useState<TeacherGradeLessonEntry[]>([])
  const [lessonDate, setLessonDate] = useState(todayIsoDate())
  const [lessonHasGrades, setLessonHasGrades] = useState(true)
  const [lessonDiaryNotes, setLessonDiaryNotes] = useState("")
  const [lessonObservations, setLessonObservations] = useState("")
  const [className, setClassName] = useState("")
  const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function scoreRefKey(studentId: string, field: ScoreField) {
    return `${studentId}:${field}`
  }

  function setScoreInputRef(studentId: string, field: ScoreField, el: HTMLInputElement | null) {
    scoreInputRefs.current[scoreRefKey(studentId, field)] = el
  }

  function focusScoreCell(rowIndex: number, field: ScoreField) {
    const row = entries[rowIndex]
    if (!row) return
    const input = scoreInputRefs.current[scoreRefKey(row.student_id, field)]
    input?.focus()
    input?.select()
  }

  function handleScoreKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: ScoreField,
  ) {
    const colIndex = scoreFieldOrder.indexOf(field)
    if (colIndex < 0) return

    let targetRow = rowIndex
    let targetCol = colIndex

    if (event.key === "Enter" || event.key === "ArrowRight") {
      if (colIndex < scoreFieldOrder.length - 1) {
        targetCol = colIndex + 1
      } else if (rowIndex < entries.length - 1) {
        targetRow = rowIndex + 1
        targetCol = 0
      } else {
        return
      }
    } else if (event.key === "ArrowLeft") {
      if (colIndex > 0) {
        targetCol = colIndex - 1
      } else if (rowIndex > 0) {
        targetRow = rowIndex - 1
        targetCol = scoreFieldOrder.length - 1
      } else {
        return
      }
    } else if (event.key === "ArrowDown") {
      if (rowIndex >= entries.length - 1) return
      targetRow = rowIndex + 1
    } else if (event.key === "ArrowUp") {
      if (rowIndex <= 0) return
      targetRow = rowIndex - 1
    } else {
      return
    }

    event.preventDefault()
    focusScoreCell(targetRow, scoreFieldOrder[targetCol])
  }

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/portal/gradebook/lessons/${lessonId}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(isEs ? "No se pudo cargar la clase." : "Nao foi possivel carregar a aula.")
        return
      }
      setLesson(data?.lesson ?? null)
      setEntries(Array.isArray(data?.entries) ? data.entries : [])
      setLessonDate(normalizeLessonDate(String(data?.lesson?.lesson_date ?? "")))
      setLessonHasGrades(data?.lesson?.has_grades === false ? false : true)
      setLessonDiaryNotes(String(data?.lesson?.diary_notes ?? data?.lesson?.notes ?? ""))
      setLessonObservations(String(data?.lesson?.observations ?? ""))
      setClassName(String(data?.lesson?.class_name ?? ""))
    } catch {
      setError(isEs ? "No se pudo cargar la clase." : "Nao foi possivel carregar a aula.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  function updateEntry(studentId: string, patch: Partial<TeacherGradeLessonEntry>) {
    setEntries((prev) =>
      prev.map((item) => (item.student_id === studentId ? { ...item, ...patch } : item)),
    )
  }

  function clampEntryScore(studentId: string, field: "c1" | "c2" | "c3" | "c4", max = scoreMax) {
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
    setSaving(true)
    setError("")
    const safeDate = normalizeLessonDate(lessonDate)
    if (safeDate !== lessonDate) setLessonDate(safeDate)

    const res = await fetch(`/api/portal/gradebook/lessons/${lessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson_date: safeDate,
        has_grades: lessonHasGrades,
        notes: lessonDiaryNotes,
        observations: lessonObservations,
        entries: lessonHasGrades
          ? entries.map((item) => ({
              student_id: item.student_id,
              attendance: item.attendance,
              c1: item.c1 ?? null,
              c2: item.c2 ?? null,
              c3: item.c3 ?? null,
              c4: item.c4 ?? null,
              comment: item.comment ?? null,
            }))
          : [],
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(String(data?.error ?? (isEs ? "No se pudo guardar la clase." : "Nao foi possivel salvar a aula.")))
      return
    }

    await load()
  }

  async function deleteLesson() {
    const ok = confirm(isEs ? "Eliminar esta clase?" : "Excluir esta aula?")
    if (!ok) return

    setSaving(true)
    setError("")
    const res = await fetch(`/api/portal/gradebook/lessons/${lessonId}`, {
      method: "DELETE",
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(String(data?.error ?? (isEs ? "No se pudo eliminar la clase." : "Nao foi possivel excluir a aula.")))
      return
    }

    router.push("/portal/dashboard/notas/lancamentos")
  }

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{isEs ? "Clase Especifica" : "Aula Especifica"}</h1>
          <p className="text-slate-300 text-sm mt-1">
            {isEs
              ? "Visualice y edite todos los datos de una clase."
              : "Visualize e edite todos os dados de uma aula."}
          </p>
        </div>
        <Link
          href="/portal/dashboard/notas/lancamentos"
          className="inline-flex items-center px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isEs ? "Volver" : "Voltar"}
        </Link>
      </div>

      <NotasSectionNav locale={locale} />

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">
            {className || (isEs ? "Clase" : "Aula")} {lesson ? `• #${lesson.lesson_number}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400">{isEs ? "Cargando..." : "Carregando..."}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[180px,1fr] gap-3">
                <div>
                  <Label className="text-white">{isEs ? "Fecha" : "Data"}</Label>
                  <Input
                    type="date"
                    value={lessonDate}
                    onChange={(e) => setLessonDate(e.target.value)}
                    onBlur={() => {
                      if (!String(lessonDate ?? "").trim()) {
                        setLessonDate(todayIsoDate())
                      }
                    }}
                    className="mt-1 bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">
                    {isEs ? "Texto libre del diario" : "Texto livre do diario"}
                  </Label>
                  <Textarea
                    value={lessonDiaryNotes}
                    onChange={(e) => setLessonDiaryNotes(e.target.value)}
                    rows={7}
                    className="mt-1 min-h-[170px] resize-y bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white">{isEs ? "Observaciones" : "Observacoes"}</Label>
                <Textarea
                  value={lessonObservations}
                  onChange={(e) => setLessonObservations(e.target.value)}
                  rows={6}
                  className="mt-1 min-h-[150px] resize-y bg-slate-800/70 border-slate-700 text-white"
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <label className="inline-flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cyan-500"
                    checked={lessonHasGrades}
                    onChange={(e) => setLessonHasGrades(e.target.checked)}
                  />
                  {isEs ? "Clase con nota" : "Aula com nota"}
                </label>
              </div>

              {lessonHasGrades ? (
              <div className="overflow-x-auto">
                <p className="mb-2 text-xs text-slate-300">
                  {isEs
                    ? "Atajo: Enter avanza C1 a C4 y al siguiente alumno. Flechas tambien navegan."
                    : "Atalho: Enter avanca C1 a C4 e para o proximo aluno. Setas tambem navegam."}
                </p>
                <table className="min-w-[760px] md:min-w-[860px] w-full text-sm">
                  <thead>
                    <tr className="text-slate-300 border-b border-white/10">
                      <th className="text-left py-2 pr-1">{isEs ? "Alumno" : "Aluno"}</th>
                      <th className="text-left py-2 pr-1">{isEs ? "Asistencia" : "Presenca"}</th>
                      <th className="text-left py-2 pr-1">C1</th>
                      <th className="text-left py-2 pr-1">C2</th>
                      <th className="text-left py-2 pr-1">C3</th>
                      <th className="text-left py-2 pr-1">C4</th>
                      <th className="text-left py-2 pr-1">{isEs ? "Comentario" : "Comentario"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, rowIndex) => (
                      <tr key={entry.student_id} className="border-b border-white/10 last:border-b-0">
                        <td className="py-2 pr-1 text-white max-w-[220px] truncate">{entry.full_name}</td>
                        <td className="py-2 pr-1">
                          <label className="inline-flex items-center">
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
                            ref={(el) => setScoreInputRef(entry.student_id, "c1", el)}
                            type="number"
                            min={0}
                            max={scoreMax}
                            step={0.01}
                            inputMode="decimal"
                            value={entry.c1 ?? ""}
                            onChange={(e) => updateEntry(entry.student_id, { c1: parseNumericInput(e.target.value, scoreMax) })}
                            onBlur={() => clampEntryScore(entry.student_id, "c1", scoreMax)}
                            onKeyDown={(e) => handleScoreKeyDown(e, rowIndex, "c1")}
                            className={scoreInputClass}
                          />
                        </td>
                        <td className="py-2 pr-1">
                          <Input
                            ref={(el) => setScoreInputRef(entry.student_id, "c2", el)}
                            type="number"
                            min={0}
                            max={scoreMax}
                            step={0.01}
                            inputMode="decimal"
                            value={entry.c2 ?? ""}
                            onChange={(e) => updateEntry(entry.student_id, { c2: parseNumericInput(e.target.value, scoreMax) })}
                            onBlur={() => clampEntryScore(entry.student_id, "c2", scoreMax)}
                            onKeyDown={(e) => handleScoreKeyDown(e, rowIndex, "c2")}
                            className={scoreInputClass}
                          />
                        </td>
                        <td className="py-2 pr-1">
                          <Input
                            ref={(el) => setScoreInputRef(entry.student_id, "c3", el)}
                            type="number"
                            min={0}
                            max={scoreMax}
                            step={0.01}
                            inputMode="decimal"
                            value={entry.c3 ?? ""}
                            onChange={(e) => updateEntry(entry.student_id, { c3: parseNumericInput(e.target.value, scoreMax) })}
                            onBlur={() => clampEntryScore(entry.student_id, "c3", scoreMax)}
                            onKeyDown={(e) => handleScoreKeyDown(e, rowIndex, "c3")}
                            className={scoreInputClass}
                          />
                        </td>
                        <td className="py-2 pr-1">
                          <Input
                            ref={(el) => setScoreInputRef(entry.student_id, "c4", el)}
                            type="number"
                            min={0}
                            max={scoreMax}
                            step={0.01}
                            inputMode="decimal"
                            value={entry.c4 ?? ""}
                            onChange={(e) => updateEntry(entry.student_id, { c4: parseNumericInput(e.target.value, scoreMax) })}
                            onBlur={() => clampEntryScore(entry.student_id, "c4", scoreMax)}
                            onKeyDown={(e) => handleScoreKeyDown(e, rowIndex, "c4")}
                            className={scoreInputClass}
                          />
                        </td>
                        <td className="py-2 pr-1">
                          <Input
                            value={entry.comment ?? ""}
                            onChange={(e) => updateEntry(entry.student_id, { comment: e.target.value })}
                            className="h-8 bg-slate-800/80 border-slate-700 text-white"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              ) : (
                <p className="text-sm text-slate-300">
                  {isEs
                    ? "Esta clase no requiere C1-C4. Solo diario y observaciones."
                    : "Esta aula nao exige C1-C4. Apenas diario e observacoes."}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={saveLesson} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
                  <Save className="w-4 h-4 mr-2" />
                  {isEs ? "Guardar" : "Salvar"}
                </Button>
                {canDeleteLesson ? (
                  <Button onClick={deleteLesson} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isEs ? "Eliminar" : "Excluir"}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

