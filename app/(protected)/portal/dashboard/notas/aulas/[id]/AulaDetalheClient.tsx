"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export default function AulaDetalheClient({
  locale,
  lessonId,
}: {
  locale: Locale
  lessonId: string
}) {
  const router = useRouter()
  const isEs = locale === "es"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [lesson, setLesson] = useState<TeacherGradeLesson | null>(null)
  const [entries, setEntries] = useState<TeacherGradeLessonEntry[]>([])
  const [lessonDate, setLessonDate] = useState(todayIsoDate())
  const [lessonNotes, setLessonNotes] = useState("")
  const [className, setClassName] = useState("")

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
      setLessonNotes(String(data?.lesson?.notes ?? ""))
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
    setSaving(true)
    setError("")
    const safeDate = normalizeLessonDate(lessonDate)
    if (safeDate !== lessonDate) setLessonDate(safeDate)

    const res = await fetch(`/api/portal/gradebook/lessons/${lessonId}`, {
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

    router.push("/portal/dashboard/notas/aulas")
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
          href="/portal/dashboard/notas/aulas"
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
                  <Label className="text-white">{isEs ? "Observaciones" : "Observacoes"}</Label>
                  <Input
                    value={lessonNotes}
                    onChange={(e) => setLessonNotes(e.target.value)}
                    className="mt-1 bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
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
                    {entries.map((entry) => (
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
                            type="number"
                            min={0}
                            max={10}
                            step={0.01}
                            inputMode="decimal"
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
                            inputMode="decimal"
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
                            inputMode="decimal"
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
                            inputMode="decimal"
                            value={entry.c4 ?? ""}
                            onChange={(e) => updateEntry(entry.student_id, { c4: parseNumericInput(e.target.value, 10) })}
                            onBlur={() => clampEntryScore(entry.student_id, "c4", 10)}
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

              <div className="flex flex-wrap gap-2">
                <Button onClick={saveLesson} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
                  <Save className="w-4 h-4 mr-2" />
                  {isEs ? "Guardar" : "Salvar"}
                </Button>
                <Button onClick={deleteLesson} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isEs ? "Eliminar" : "Excluir"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

