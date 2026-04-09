"use client"

import { useEffect, useMemo, useState } from "react"
import { FileSpreadsheet, Lock, RefreshCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TeacherClass } from "@/app/types/portal"
import { formatDatePtBr } from "@/lib/format-date"
import { getTurmaYearLabel } from "@/lib/turma-years"
import NotasSectionNav from "../_components/NotasSectionNav"

type Locale = "pt-BR" | "es"

type SummaryRow = {
  student_id: string
  full_name: string
  graded_lessons: number
  presence_count: number
  absence_count: number
  note1: number | string | null
}

type GradeFormItem = {
  exam_score: string
  c5_score: string
  manual_final_score: string
  notes: string
}

function parseNumber(value: string, max = 10) {
  const clean = String(value ?? "").replace(",", ".").trim()
  if (!clean) return null
  const n = Number(clean)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(max, Math.round(n * 100) / 100))
}

function clampInputValue(value: string, max = 10) {
  const parsed = parseNumber(value, max)
  if (parsed === null) return ""
  return String(parsed)
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function display(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return Number(value).toFixed(2)
}

function calcNote2(exam: number | null, c5: number | null) {
  if (exam !== null && c5 !== null) return Math.round(((exam + c5) / 2) * 100) / 100
  if (exam === null && c5 !== null) return Math.round(c5 * 100) / 100
  return null
}

function calcFinal(note1: number | null, note2: number | null) {
  if (note1 === null || note2 === null) return null
  return Math.round(((note1 + note2) / 2) * 100) / 100
}

const scoreInputClass =
  "h-7 w-14 md:w-16 bg-slate-800/80 border-slate-700 text-slate-100 text-center text-xs px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

export default function ResumoClient({ locale }: { locale: Locale }) {
  const isEs = locale === "es"
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [error, setError] = useState("")
  const [isClosed, setIsClosed] = useState(false)
  const [lockedAt, setLockedAt] = useState<string | null>(null)

  const [schoolYear, setSchoolYear] = useState<number>(new Date().getFullYear())
  const [bimester, setBimester] = useState<number>(1)
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [gradeForm, setGradeForm] = useState<Record<string, GradeFormItem>>({})

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  )

  function clampStudentField(
    studentId: string,
    field: "exam_score" | "c5_score" | "manual_final_score",
    max = 10,
  ) {
    setGradeForm((prev) => {
      const current = prev[studentId]
      if (!current) return prev
      const clamped = clampInputValue(current[field], max)
      if (current[field] === clamped) return prev
      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: clamped,
        },
      }
    })
  }

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

  async function loadResumo(classId: string) {
    if (!classId) {
      setSummaryRows([])
      setGradeForm({})
      setIsClosed(false)
      setLockedAt(null)
      return
    }

    const [summaryRes, gradesRes] = await Promise.all([
      fetch(`/api/portal/gradebook/summary?classId=${classId}&bimester=${bimester}&schoolYear=${schoolYear}`, {
        cache: "no-store",
      }),
      fetch(
        `/api/portal/gradebook/bimester-grades?classId=${classId}&bimester=${bimester}&schoolYear=${schoolYear}`,
        { cache: "no-store" },
      ),
    ])

    const summaryData = await summaryRes.json().catch(() => ({}))
    const gradesData = await gradesRes.json().catch(() => [])
    const scope = (summaryData?.scope ?? {}) as { closed?: boolean; locked_at?: string | null }
    setIsClosed(scope.closed === true)
    setLockedAt(scope.locked_at ?? null)

    const students: SummaryRow[] = Array.isArray(summaryData?.students) ? summaryData.students : []
    const grades = Array.isArray(gradesData) ? gradesData : []

    const formMap: Record<string, GradeFormItem> = {}
    for (const row of grades) {
      const studentId = String(row?.student_id ?? "")
      if (!studentId) continue
      formMap[studentId] = {
        exam_score: row?.exam_score === null || row?.exam_score === undefined ? "" : String(row.exam_score),
        c5_score: row?.c5_score === null || row?.c5_score === undefined ? "" : String(row.c5_score),
        manual_final_score:
          row?.manual_final_score === null || row?.manual_final_score === undefined
            ? ""
            : String(row.manual_final_score),
        notes: String(row?.notes ?? ""),
      }
    }

    for (const row of students) {
      if (!formMap[row.student_id]) {
        formMap[row.student_id] = { exam_score: "", c5_score: "", manual_final_score: "", notes: "" }
      }
    }

    setSummaryRows(students)
    setGradeForm(formMap)
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
    loadResumo(selectedClassId).catch(() => setError(isEs ? "Error al cargar resumen." : "Erro ao carregar resumo."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, bimester, schoolYear, loading])

  async function saveNote2() {
    if (!selectedClassId) return
    if (isClosed) {
      setError(isEs ? "Bimestre cerrado. No se puede editar." : "Bimestre fechado. Nao e possivel editar.")
      return
    }

    const missingExam = Object.values(gradeForm).some((item) => parseNumber(item.exam_score) === null)
    if (missingExam) {
      setError(
        isEs
          ? "Campo Prueba/Actividad es obligatorio para todos."
          : "Campo Prova/Atividade e obrigatorio para todos.",
      )
      return
    }

    setSaving(true)
    setError("")

    const payload = Object.entries(gradeForm).map(([student_id, item]) => ({
      student_id,
      has_exam: true,
      exam_score: parseNumber(item.exam_score),
      c5_score: parseNumber(item.c5_score),
      manual_final_score: parseNumber(item.manual_final_score),
      notes: item.notes || null,
    }))

    const res = await fetch("/api/portal/gradebook/bimester-grades", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: selectedClassId,
        school_year: schoolYear,
        bimester,
        grades: payload,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(String(data?.error ?? (isEs ? "No se pudo guardar." : "Nao foi possivel salvar.")))
      return
    }

    await loadResumo(selectedClassId)
  }

  async function closeBimester() {
    if (!selectedClassId || isClosed) return

    const ok = confirm(
      isEs
        ? "Cerrar este bimestre? No se permitiran mas lanzamientos."
        : "Fechar este bimestre? Nao sera possivel fazer novos lancamentos.",
    )
    if (!ok) return

    setClosing(true)
    setError("")

    const res = await fetch("/api/portal/gradebook/bimester-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: selectedClassId,
        school_year: schoolYear,
        bimester,
      }),
    })
    const data = await res.json().catch(() => null)
    setClosing(false)

    if (!res.ok) {
      setError(String(data?.error ?? (isEs ? "No se pudo cerrar el bimestre." : "Nao foi possivel fechar o bimestre.")))
      return
    }

    setIsClosed(true)
    setLockedAt(String(data?.lock?.locked_at ?? new Date().toISOString()))

    if (bimester < 4) {
      setBimester((prev) => (prev < 4 ? prev + 1 : prev))
      setIsClosed(false)
      setLockedAt(null)
      return
    }

    await loadResumo(selectedClassId)
  }

  async function reopenBimester() {
    if (!selectedClassId || !isClosed) return

    const ok = confirm(
      isEs
        ? "Reabrir este bimestre? Sera posible volver a lanzar notas y presencia."
        : "Reativar este bimestre? Sera possivel voltar a lancar notas e presenca.",
    )
    if (!ok) return

    setReopening(true)
    setError("")

    const res = await fetch("/api/portal/gradebook/bimester-lock", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: selectedClassId,
        school_year: schoolYear,
        bimester,
      }),
    })
    const data = await res.json().catch(() => null)
    setReopening(false)

    if (!res.ok) {
      setError(
        String(data?.error ?? (isEs ? "No se pudo reabrir el bimestre." : "Nao foi possivel reativar o bimestre.")),
      )
      return
    }

    setIsClosed(false)
    setLockedAt(null)
    await loadResumo(selectedClassId)
  }

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-cyan-300" />
          {isEs ? "Resumen Bimestral" : "Resumo Bimestral"}
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          {isEs
            ? "Pagina general para ver las notas de cada alumno por turma."
            : "Pagina geral para ver as notas de cada aluno por turma."}
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
              <Button
                onClick={refreshAll}
                disabled={syncing}
                className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
              >
                <RefreshCcw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {isEs ? "Actualizar" : "Atualizar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClass ? (
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">
              {selectedClass.name} • #{selectedClass.id.slice(0, 8)} • {isEs ? "Bimestre" : "Bimestre"} {bimester}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
              <p className="text-xs text-cyan-100 font-medium mb-2">{isEs ? "Criterios evaluativos" : "Criterios avaliativos"}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 text-[11px] leading-relaxed text-cyan-50/90">
                <p><strong>C1</strong> - Resolucao de problemas e pensamento critico.</p>
                <p><strong>C2</strong> - Criatividade e inovacao.</p>
                <p><strong>C3</strong> - Colaboracao e trabalho em equipe.</p>
                <p><strong>C4</strong> - Aplicacao de conceitos STEAM e tecnologia.</p>
                <p><strong>C5</strong> - Registro e fundamentacao.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                  isClosed
                    ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
                    : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                {isClosed ? (isEs ? "Bimestre cerrado" : "Bimestre fechado") : (isEs ? "Bimestre abierto" : "Bimestre aberto")}
              </span>
              {isClosed && lockedAt ? (
                <span className="text-xs text-slate-300">
                  {isEs ? "Cerrado en" : "Fechado em"} {formatDatePtBr(lockedAt)}
                </span>
              ) : null}
              {isClosed ? (
                <Button onClick={reopenBimester} disabled={reopening} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">
                  <RefreshCcw className={`w-4 h-4 mr-2 ${reopening ? "animate-spin" : ""}`} />
                  {reopening
                    ? isEs
                      ? "Reabriendo..."
                      : "Reativando..."
                    : isEs
                      ? "Reabrir Bimestre"
                      : "Reativar Bimestre"}
                </Button>
              ) : (
                <Button onClick={closeBimester} disabled={closing} className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60">
                  <Lock className="w-4 h-4 mr-2" />
                  {closing
                    ? isEs
                      ? "Cerrando..."
                      : "Fechando..."
                    : isEs
                      ? "Cerrar Bimestre"
                      : "Fechar Bimestre"}
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] md:min-w-[1080px] w-full text-sm text-slate-100">
                <thead>
                  <tr className="text-slate-200 border-b border-white/10">
                    <th className="text-left py-2 pr-2">{isEs ? "Alumno" : "Aluno"}</th>
                    <th className="text-center py-2 pr-1">{isEs ? "Presencias" : "Presencas"}</th>
                    <th className="text-center py-2 pr-1">{isEs ? "Faltas" : "Faltas"}</th>
                    <th className="text-center py-2 pr-1">{isEs ? "Clases" : "Aulas"}</th>
                    <th className="text-center py-2 pr-1">Nota 1</th>
                    <th className="text-center py-2 pr-1">{isEs ? "Prueba/Actividad" : "Prova/Atividade"}</th>
                    <th className="text-center py-2 pr-1">C5</th>
                    <th className="text-center py-2 pr-1">Nota 2</th>
                    <th className="text-center py-2 pr-1">{isEs ? "Final (manual)" : "Nota Final"}</th>
                    <th className="text-left py-2">{isEs ? "Observaciones" : "Observacoes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => {
                    const form = gradeForm[row.student_id] ?? {
                      exam_score: "",
                      c5_score: "",
                      manual_final_score: "",
                      notes: "",
                    }

                    const note1 = toNumber(row.note1)
                    const exam = parseNumber(form.exam_score)
                    const c5 = parseNumber(form.c5_score)
                    const manualFinal = parseNumber(form.manual_final_score)
                    const note2 = calcNote2(exam, c5)
                    const calculatedFinal = calcFinal(note1, note2)
                    const finalGrade = manualFinal ?? calculatedFinal

                    return (
                      <tr key={row.student_id} className="border-b border-white/10 last:border-b-0 odd:bg-white/[0.02]">
                        <td className="py-2 pr-2 text-white max-w-[220px] truncate">{row.full_name}</td>
                        <td className="py-2 pr-1 text-slate-100 text-center">{row.presence_count ?? 0}</td>
                        <td className="py-2 pr-1 text-slate-100 text-center">{row.absence_count ?? 0}</td>
                        <td className="py-2 pr-1 text-slate-100 text-center">{row.graded_lessons ?? 0}</td>
                        <td className="py-2 pr-1 text-slate-100 text-center">{display(note1)}</td>
                        <td className="py-2 pr-1 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            step={0.01}
                            inputMode="decimal"
                            value={form.exam_score}
                            onChange={(e) =>
                              setGradeForm((prev) => ({
                                ...prev,
                                [row.student_id]: { ...prev[row.student_id], exam_score: e.target.value },
                              }))
                            }
                            onBlur={() => clampStudentField(row.student_id, "exam_score", 10)}
                            className={scoreInputClass}
                            disabled={isClosed}
                          />
                        </td>
                        <td className="py-2 pr-1 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            step={0.01}
                            inputMode="decimal"
                            value={form.c5_score}
                            onChange={(e) =>
                              setGradeForm((prev) => ({
                                ...prev,
                                [row.student_id]: { ...prev[row.student_id], c5_score: e.target.value },
                              }))
                            }
                            onBlur={() => clampStudentField(row.student_id, "c5_score", 10)}
                            className={scoreInputClass}
                            disabled={isClosed}
                          />
                        </td>
                        <td className="py-2 pr-1 text-slate-100 text-center">{display(note2)}</td>
                        <td className="py-2 pr-1 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            step={0.01}
                            inputMode="decimal"
                            value={form.manual_final_score}
                            placeholder={display(calculatedFinal)}
                            onChange={(e) =>
                              setGradeForm((prev) => ({
                                ...prev,
                                [row.student_id]: { ...prev[row.student_id], manual_final_score: e.target.value },
                              }))
                            }
                            onBlur={() => clampStudentField(row.student_id, "manual_final_score", 10)}
                            className={scoreInputClass}
                            title={`${isEs ? "Valor final" : "Valor final"}: ${display(finalGrade)}`}
                            disabled={isClosed}
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            value={form.notes}
                            onChange={(e) =>
                              setGradeForm((prev) => ({
                                ...prev,
                                [row.student_id]: { ...prev[row.student_id], notes: e.target.value },
                              }))
                            }
                            className="h-8 min-w-[180px] bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-400"
                            disabled={isClosed}
                          />
                        </td>
                      </tr>
                    )
                  })}
                  {summaryRows.length === 0 ? (
                    <tr>
                      <td className="py-3 text-slate-400" colSpan={10}>
                        {isEs ? "No hay datos para el bimestre seleccionado." : "Sem dados para o bimestre selecionado."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <Button onClick={saveNote2} disabled={saving || isClosed} className="bg-cyan-600 hover:bg-cyan-700">
              <Save className="w-4 h-4 mr-2" />
              {saving ? (isEs ? "Guardando..." : "Salvando...") : isEs ? "Guardar Nota 2" : "Salvar Nota 2"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-400">
              {isEs ? "Seleccione una turma para ver el resumen." : "Selecione uma turma para ver o resumo."}
            </p>
          </CardContent>
        </Card>
      )}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}
