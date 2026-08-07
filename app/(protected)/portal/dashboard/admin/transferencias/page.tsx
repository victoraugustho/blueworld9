"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRightLeft, CheckSquare, Copy, RefreshCcw, Search, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Teacher, TeacherClass } from "@/app/types/portal"
import { getTurmaYearLabel } from "@/lib/turma-years"

type Mode = "transfer" | "duplicate"

export default function ClassTransfersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [sourceTeacherId, setSourceTeacherId] = useState("")
  const [targetTeacherId, setTargetTeacherId] = useState("")
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>("transfer")
  const [query, setQuery] = useState("")
  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [confirmationText, setConfirmationText] = useState("")
  const [riskAccepted, setRiskAccepted] = useState(false)

  async function loadTeachers() {
    setLoadingTeachers(true)
    setError("")
    try {
      const res = await fetch("/api/admin/teachers", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data?.error ?? "Erro ao carregar professores."))
      const approved = Array.isArray(data?.approved) ? data.approved : []
      const sorted = approved.sort((a: Teacher, b: Teacher) => a.name.localeCompare(b.name, "pt-BR"))
      setTeachers(sorted)
      setSourceTeacherId((current) => current || sorted[0]?.id || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar professores.")
    } finally {
      setLoadingTeachers(false)
    }
  }

  async function loadClasses(teacherId: string) {
    setSelectedClassIds([])
    setClasses([])
    setError("")
    setSuccess("")
    if (!teacherId) return

    setLoadingClasses(true)
    try {
      const res = await fetch(
        `/api/portal/gradebook/classes?teacherId=${encodeURIComponent(teacherId)}&allYears=1`,
        { cache: "no-store" },
      )
      const data = await res.json().catch(() => [])
      if (!res.ok) throw new Error(String(data?.error ?? "Erro ao carregar turmas."))
      setClasses(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar turmas.")
    } finally {
      setLoadingClasses(false)
    }
  }

  useEffect(() => {
    void loadTeachers()
  }, [])

  useEffect(() => {
    void loadClasses(sourceTeacherId)
    setTargetTeacherId((current) =>
      current && current !== sourceTeacherId
        ? current
        : teachers.find((teacher) => teacher.id !== sourceTeacherId)?.id ?? "",
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceTeacherId, teachers])

  const filteredClasses = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return classes
    return classes.filter((item) => {
      const yearLabel = item.student_year ? getTurmaYearLabel(Number(item.student_year)) : "sem ano"
      return `${item.name} ${item.school_year} ${yearLabel} ${item.id}`.toLowerCase().includes(normalized)
    })
  }, [classes, query])

  const selectedSet = useMemo(() => new Set(selectedClassIds), [selectedClassIds])
  const allFilteredSelected =
    filteredClasses.length > 0 && filteredClasses.every((item) => selectedSet.has(item.id))

  function toggleClass(classId: string) {
    setSelectedClassIds((current) =>
      current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId],
    )
  }

  function toggleAllFiltered() {
    setSelectedClassIds((current) => {
      const next = new Set(current)
      if (allFilteredSelected) filteredClasses.forEach((item) => next.delete(item.id))
      else filteredClasses.forEach((item) => next.add(item.id))
      return Array.from(next)
    })
  }

  function requestConfirmation() {
    if (!sourceTeacherId || !targetTeacherId || selectedClassIds.length === 0 || processing) return
    setConfirmationText("")
    setRiskAccepted(false)
    setConfirmationOpen(true)
  }

  function closeConfirmation() {
    if (processing) return
    setConfirmationOpen(false)
    setConfirmationText("")
    setRiskAccepted(false)
  }

  async function executeConfirmed() {
    const requiredText = mode === "transfer" ? "TRANSFERIR" : "DUPLICAR"
    if (
      !confirmationOpen ||
      confirmationText.trim().toUpperCase() !== requiredText ||
      !riskAccepted ||
      !sourceTeacherId ||
      !targetTeacherId ||
      selectedClassIds.length === 0 ||
      processing
    ) return

    const selectedClasses = classes.filter((item) => selectedSet.has(item.id))

    setProcessing(true)
    setError("")
    setSuccess("")
    let completed = 0

    for (const item of selectedClasses) {
      setProgress(`${mode === "transfer" ? "Transferindo" : "Duplicando"} ${completed + 1} de ${selectedClasses.length}: ${item.name}`)
      const res = await fetch("/api/admin/teacher-classes/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          source_class_id: item.id,
          target_teacher_id: targetTeacherId,
          target_class_name: null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const failureMessage = `${completed} de ${selectedClasses.length} concluída(s). Falha em “${item.name}”: ${String(data?.error ?? "erro desconhecido")}`
        setProcessing(false)
        setProgress("")
        setConfirmationOpen(false)
        if (mode === "transfer") await loadClasses(sourceTeacherId)
        setError(failureMessage)
        return
      }
      completed += 1
    }

    setProcessing(false)
    setProgress("")
    setConfirmationOpen(false)
    setSelectedClassIds([])
    if (mode === "transfer") await loadClasses(sourceTeacherId)
    setSuccess(`${completed} turma(s) ${mode === "transfer" ? "transferida(s)" : "duplicada(s)"} com sucesso.`)
  }

  const targetTeachers = teachers.filter((teacher) => teacher.id !== sourceTeacherId)

  return (
    <div className="p-6 text-white space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-cyan-300" />
            Transferir ou duplicar turmas
          </h1>
          <p className="mt-1 text-slate-300">Escolha os professores de saída e entrada e selecione uma, várias ou todas as turmas.</p>
        </div>
        <Button onClick={() => void loadTeachers()} disabled={loadingTeachers || processing} className="bg-white/10 hover:bg-white/15 border border-white/10">
          <RefreshCcw className={`w-4 h-4 mr-2 ${loadingTeachers ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card className="bg-slate-900/30 border border-white/10">
        <CardHeader><CardTitle className="text-white text-base">Configuração da operação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-300">Professor de saída (origem)</label>
            <select value={sourceTeacherId} onChange={(e) => setSourceTeacherId(e.target.value)} disabled={processing} className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white">
              <option value="">Selecione</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} | {teacher.email}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-300">Professor de entrada (destino)</label>
            <select value={targetTeacherId} onChange={(e) => setTargetTeacherId(e.target.value)} disabled={processing} className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white">
              <option value="">Selecione</option>
              {targetTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} | {teacher.email}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-300">Operação</label>
            <select value={mode} onChange={(e) => setMode(e.target.value === "duplicate" ? "duplicate" : "transfer")} disabled={processing} className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white">
              <option value="transfer">Transferir (move os dados)</option>
              <option value="duplicate">Duplicar (copia os dados)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/30 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex flex-wrap items-center justify-between gap-3">
            <span>Turmas do professor de saída</span>
            <span className="text-xs font-normal text-slate-300">{selectedClassIds.length} selecionada(s) de {classes.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar turma, ano ou ID..." className="pl-9 bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <Button type="button" onClick={toggleAllFiltered} disabled={loadingClasses || filteredClasses.length === 0 || processing} className="bg-white/10 hover:bg-white/15 border border-white/10">
              {allFilteredSelected ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
              {allFilteredSelected ? "Desmarcar exibidas" : query ? "Selecionar exibidas" : "Selecionar todas"}
            </Button>
          </div>

          {loadingClasses ? <p className="text-slate-400">Carregando turmas...</p> : null}
          {!loadingClasses && classes.length === 0 ? <p className="text-slate-400">Este professor não possui turmas.</p> : null}
          {!loadingClasses && classes.length > 0 && filteredClasses.length === 0 ? <p className="text-slate-400">Nenhuma turma encontrada.</p> : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {filteredClasses.map((item) => {
              const checked = selectedSet.has(item.id)
              return (
                <label key={item.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${checked ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/[0.08]"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleClass(item.id)} disabled={processing} className="mt-1" />
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-300">{item.student_year ? getTurmaYearLabel(Number(item.student_year)) : "Sem ano"} | {item.school_year} | {item.student_count ?? 0} alunos | #{item.id.slice(0, 8)}</p>
                  </div>
                </label>
              )
            })}
          </div>

          {error ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
          {success ? <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</p> : null}
          {progress ? <p className="text-sm text-cyan-200">{progress}</p> : null}

          <Button onClick={requestConfirmation} disabled={processing || !sourceTeacherId || !targetTeacherId || selectedClassIds.length === 0} className="bg-cyan-600 hover:bg-cyan-700">
            {mode === "transfer" ? <ArrowRightLeft className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {processing ? "Processando..." : mode === "transfer" ? `Transferir ${selectedClassIds.length} turma(s)` : `Duplicar ${selectedClassIds.length} turma(s)`}
          </Button>
        </CardContent>
      </Card>

      {confirmationOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-4" role="dialog" aria-modal="true" aria-labelledby="sensitive-action-title">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />
          <Card className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-hidden border border-rose-400/35 bg-slate-900/98 text-white shadow-2xl">
            <CardHeader className="border-b border-rose-400/20 bg-rose-500/10">
              <CardTitle className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="rounded-full bg-rose-500/20 p-2 text-rose-300"><AlertTriangle className="w-5 h-5" /></span>
                  <div>
                    <p id="sensitive-action-title">Confirmação de ação sensível</p>
                    <p className="mt-1 text-sm font-normal text-slate-300">Revise todos os dados antes de continuar.</p>
                  </div>
                </div>
                <Button type="button" size="icon-sm" onClick={closeConfirmation} disabled={processing} className="bg-white/10 hover:bg-white/15 border border-white/10" aria-label="Cancelar e fechar">
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(92vh-84px)] overflow-y-auto space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">Professor de saída</p>
                  <p className="font-medium text-white">{teachers.find((item) => item.id === sourceTeacherId)?.name ?? "-"}</p>
                  <p className="text-xs text-slate-300 break-all">{teachers.find((item) => item.id === sourceTeacherId)?.email ?? ""}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">Professor de entrada</p>
                  <p className="font-medium text-white">{teachers.find((item) => item.id === targetTeacherId)?.name ?? "-"}</p>
                  <p className="text-xs text-slate-300 break-all">{teachers.find((item) => item.id === targetTeacherId)?.email ?? ""}</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                <p className="text-sm font-semibold text-white">{selectedClassIds.length} turma(s) selecionada(s)</p>
                <div className="mt-2 max-h-32 overflow-y-auto text-sm text-slate-300">
                  {classes.filter((item) => selectedSet.has(item.id)).map((item) => (
                    <p key={item.id}>• {item.name} — {item.school_year} — #{item.id.slice(0, 8)}</p>
                  ))}
                </div>
              </div>

              <div className={`rounded-lg border p-3 text-sm ${mode === "transfer" ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-amber-400/30 bg-amber-500/10 text-amber-100"}`}>
                {mode === "transfer" ? (
                  <p><strong>Transferência:</strong> as turmas deixarão o professor de saída e serão movidas, com agenda, alunos, aulas, notas, fechamentos e registros, para o professor de entrada.</p>
                ) : (
                  <p><strong>Duplicação:</strong> novas cópias completas serão criadas para o professor de entrada. Os dados originais permanecerão com o professor de saída.</p>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 cursor-pointer">
                <input type="checkbox" checked={riskAccepted} onChange={(e) => setRiskAccepted(e.target.checked)} disabled={processing} className="mt-1" />
                <span className="text-sm text-slate-200">Confirmo que revisei os professores, as turmas e entendo as consequências desta operação.</span>
              </label>

              <div>
                <label className="text-sm text-slate-200">Digite <strong className="text-white">{mode === "transfer" ? "TRANSFERIR" : "DUPLICAR"}</strong> para confirmar:</label>
                <Input
                  autoFocus
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  disabled={processing}
                  autoComplete="off"
                  className="mt-2 bg-slate-800 border-slate-600 text-white uppercase"
                />
              </div>

              {progress ? <p className="text-sm text-cyan-200">{progress}</p> : null}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-white/10 pt-4">
                <Button type="button" onClick={closeConfirmation} disabled={processing} className="bg-white/10 hover:bg-white/15 border border-white/10">Cancelar</Button>
                <Button
                  type="button"
                  onClick={() => void executeConfirmed()}
                  disabled={processing || !riskAccepted || confirmationText.trim().toUpperCase() !== (mode === "transfer" ? "TRANSFERIR" : "DUPLICAR")}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {processing ? "Processando..." : mode === "transfer" ? "Confirmar transferência" : "Confirmar duplicação"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
