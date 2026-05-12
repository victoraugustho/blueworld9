"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CalendarRange, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TeacherClass, TeacherGradeLesson } from "@/app/types/portal"
import { formatDatePtBr } from "@/lib/format-date"
import { getTurmaYearLabel } from "@/lib/turma-years"
import NotasSectionNav from "../_components/NotasSectionNav"

type Locale = "pt-BR" | "es"

export default function AulasClient({ locale }: { locale: Locale }) {
  const isEs = locale === "es"
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")

  const [schoolYear, setSchoolYear] = useState<number>(new Date().getFullYear())
  const [bimester, setBimester] = useState<number>(1)
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [lessons, setLessons] = useState<TeacherGradeLesson[]>([])

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
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
      return
    }
    const res = await fetch(
      `/api/portal/gradebook/lessons?classId=${classId}&bimester=${bimester}&schoolYear=${schoolYear}`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => [])
    setLessons(Array.isArray(data) ? data : [])
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

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CalendarRange className="w-7 h-7 text-cyan-300" />
          {isEs ? "Clases por Turma" : "Aulas por Turma"}
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          {isEs
            ? "Visualice todas las clases de una turma y abra una clase especifica."
            : "Visualize todas as aulas de uma turma e abra uma aula especifica."}
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
                    {item.name} {item.student_year ? `- ${getTurmaYearLabel(item.student_year)}` : ""} • #{item.id.slice(0, 8)}
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
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">
              {selectedClass.name} • #{selectedClass.id.slice(0, 8)} - {isEs ? "Bimestre" : "Bimestre"} {bimester}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lessons.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {lessons.map((lesson) => (
                  <article key={lesson.id} className="rounded-lg border border-white/10 bg-slate-950/35 p-4 space-y-3">
                    <div>
                      <p className="text-sm text-slate-300">{isEs ? "Clase" : "Aula"}</p>
                      <p className="text-xl font-bold text-white">{lesson.lesson_number}</p>
                    </div>
                    <p className="text-sm text-slate-300">
                      {formatDatePtBr(lesson.lesson_date)} -{" "}
                      {lesson.has_grades === false
                        ? isEs
                          ? "Sin nota"
                          : "Sem nota"
                        : `${isEs ? "Lanzamientos" : "Lancamentos"}: ${lesson.entries_count ?? 0}`}
                    </p>
                    <p className="text-sm text-slate-300">
                      {lesson.has_grades === false
                        ? isEs
                          ? "Registro solo en diario"
                          : "Registro apenas em diario"
                        : `${isEs ? "Faltas" : "Faltas"}: ${lesson.absences_count ?? 0}`}
                    </p>
                    <Link
                      href="/portal/dashboard/notas/lancamentos"
                      className="inline-flex items-center text-cyan-300 hover:text-cyan-200 text-sm"
                    >
                      {isEs ? "Abrir clase" : "Abrir aula"}
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {isEs ? "No hay clases registradas." : "Nao ha aulas registradas."}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-400">
              {isEs ? "Seleccione una turma para visualizar clases." : "Selecione uma turma para visualizar aulas."}
            </p>
          </CardContent>
        </Card>
      )}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

