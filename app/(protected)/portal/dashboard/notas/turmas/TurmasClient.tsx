"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Eye, GraduationCap, Pencil, Plus, RefreshCcw, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TeacherClass } from "@/app/types/portal"
import { getTurmaYearLabel } from "@/lib/turma-years"
import NotasSectionNav from "../_components/NotasSectionNav"

type Locale = "pt-BR" | "es"

type ClassWithStats = TeacherClass & {
  active_student_count?: number
}

type TeacherOption = {
  id: string
  name: string
  email: string
}

export default function TurmasClient({ locale, isAdmin }: { locale: Locale; isAdmin: boolean }) {
  const isEs = locale === "es"
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const [error, setError] = useState("")
  const [schoolYear, setSchoolYear] = useState<number>(new Date().getFullYear())
  const [classes, setClasses] = useState<ClassWithStats[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState("")

  async function loadClasses(targetYear = schoolYear, targetTeacherId = selectedTeacherId) {
    const search = new URLSearchParams()
    search.set("schoolYear", String(targetYear))
    if (isAdmin && targetTeacherId) {
      search.set("teacherId", targetTeacherId)
    }

    const res = await fetch(`/api/portal/gradebook/classes?${search.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => [])
    setClasses(Array.isArray(data) ? data : [])
  }

  async function loadTeachers() {
    if (!isAdmin) return

    const res = await fetch("/api/admin/teachers", { cache: "no-store" })
    const data = await res.json().catch(() => null)

    const approved = Array.isArray(data?.approved) ? data.approved : []
    const mapped: TeacherOption[] = approved
      .filter((item: any) => item?.id && item?.name)
      .map((item: any) => ({
        id: String(item.id),
        name: String(item.name),
        email: String(item.email ?? ""),
      }))

    setTeachers(mapped)
    if (!selectedTeacherId && mapped.length > 0) {
      setSelectedTeacherId(mapped[0].id)
    }
  }

  async function refreshAll() {
    setSyncing(true)
    setError("")
    try {
      await loadClasses(schoolYear, selectedTeacherId)
    } catch {
      setError(isEs ? "No se pudo actualizar." : "Nao foi possivel atualizar.")
    } finally {
      setSyncing(false)
    }
  }

  async function deleteClass(classId: string) {
    const ok = confirm(
      isEs
        ? "Eliminar esta turma y todos los datos de notas asociados?"
        : "Excluir esta turma e todos os dados de notas associados?",
    )
    if (!ok) return

    setDeletingId(classId)
    setError("")
    const res = await fetch(`/api/portal/gradebook/classes/${classId}`, {
      method: "DELETE",
    })
    setDeletingId("")

    if (!res.ok) {
      setError(isEs ? "No se pudo eliminar la turma." : "Nao foi possivel excluir a turma.")
      return
    }

    await loadClasses(schoolYear)
  }

  useEffect(() => {
    let active = true
    async function bootstrap() {
      setLoading(true)
      try {
        if (isAdmin) {
          await loadTeachers()
        }
      } catch {
        if (active) {
          setError(isEs ? "No se pudo cargar los profesores." : "Nao foi possivel carregar os professores.")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    bootstrap()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  useEffect(() => {
    if (loading) return
    if (isAdmin && !selectedTeacherId) {
      setClasses([])
      return
    }
    loadClasses(schoolYear, selectedTeacherId).catch(() =>
      setError(isEs ? "Error al cargar turmas." : "Erro ao carregar turmas."),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear, selectedTeacherId, isAdmin, loading])

  const totals = useMemo(() => {
    const totalTurmas = classes.length
    const totalStudents = classes.reduce((sum, item) => sum + Number(item.student_count ?? 0), 0)
    const totalActive = classes.filter((item) => item.active === true).length
    return { totalTurmas, totalStudents, totalActive }
  }, [classes])

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GraduationCap className="w-7 h-7 text-cyan-300" />
          {isEs ? "Turmas y Alumnos" : "Turmas e Alunos"}
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          {isAdmin
            ? isEs
              ? "Gestion administrativa de turmas por profesor."
              : "Gestao administrativa de turmas por professor."
            : isEs
              ? "Visualizacion de turmas asignadas."
              : "Visualizacao das turmas vinculadas."}
        </p>
      </div>

      <NotasSectionNav locale={locale} />

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3 justify-between">
            <div className="flex flex-wrap items-end gap-3">
              {isAdmin && (
                <div>
                  <Label className="text-white">{isEs ? "Profesor" : "Professor"}</Label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(String(e.target.value))}
                    className="w-[320px] max-w-full mt-1 h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
                  >
                    {teachers.length === 0 ? (
                      <option value="">{isEs ? "Sin profesores" : "Sem professores"}</option>
                    ) : (
                      teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name} - {teacher.email}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div>
                <Label className="text-white">{isEs ? "Ano lectivo" : "Ano letivo"}</Label>
                <Input
                  type="number"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(Number(e.target.value || new Date().getFullYear()))}
                  className="mt-1 w-36 bg-slate-800/70 border-slate-700 text-white"
                />
              </div>
              <Button
                onClick={refreshAll}
                disabled={syncing}
                className="bg-white/10 hover:bg-white/15 border border-white/10"
              >
                <RefreshCcw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {isEs ? "Actualizar" : "Atualizar"}
              </Button>
            </div>

            {isAdmin &&
              (selectedTeacherId ? (
                <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
                  <Link href={`/portal/dashboard/notas/turmas/nova?teacherId=${selectedTeacherId}`}>
                    <Plus className="w-4 h-4 mr-2" />
                    {isEs ? "Nueva turma" : "Nova turma"}
                  </Link>
                </Button>
              ) : (
                <Button disabled className="bg-cyan-600/60">
                  <Plus className="w-4 h-4 mr-2" />
                  {isEs ? "Nueva turma" : "Nova turma"}
                </Button>
              ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-300 uppercase tracking-wide">{isEs ? "Turmas" : "Turmas"}</p>
            <p className="text-2xl font-bold text-white mt-1">{totals.totalTurmas}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-300 uppercase tracking-wide">{isEs ? "Activas" : "Ativas"}</p>
            <p className="text-2xl font-bold text-white mt-1">{totals.totalActive}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-300 uppercase tracking-wide">{isEs ? "Alumnos" : "Alunos"}</p>
            <p className="text-2xl font-bold text-white mt-1">{totals.totalStudents}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-300" />
            {isEs ? "Listado de Turmas" : "Listagem de Turmas"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-300">{isEs ? "Cargando..." : "Carregando..."}</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-slate-400">{isEs ? "Sin turmas para este ano." : "Sem turmas para este ano."}</p>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-950/30">
              {classes.map((item) => {
                const yearLabel = item.student_year ? getTurmaYearLabel(item.student_year) : isEs ? "Sin ano" : "Sem ano"
                const deleting = deletingId === item.id

                return (
                  <div
                    key={item.id}
                    className="px-3 md:px-4 py-3 border-b border-white/10 last:border-b-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white truncate">{item.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200">{yearLabel}</span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200">
                          {isEs ? "Ano" : "Ano"}: {item.school_year}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200">
                          ID: #{item.id.slice(0, 8)}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${item.active ? "bg-emerald-600/30 text-emerald-100" : "bg-rose-600/30 text-rose-100"}`}>
                          {item.active ? (isEs ? "Activa" : "Ativa") : (isEs ? "Inactiva" : "Inativa")}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-cyan-600/25 text-cyan-100">
                          {isEs ? "Alumnos" : "Alunos"}: {Number(item.student_count ?? 0)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button asChild size="icon-sm" title={isEs ? "Visualizar turma" : "Visualizar turma"} aria-label={isEs ? "Visualizar turma" : "Visualizar turma"} className="bg-white/10 hover:bg-white/20 border border-white/15">
                        <Link href={`/portal/dashboard/notas/turmas/${item.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                      {isAdmin && (
                        <>
                          <Button asChild size="icon-sm" title={isEs ? "Editar turma" : "Editar turma"} aria-label={isEs ? "Editar turma" : "Editar turma"} className="bg-blue-600 hover:bg-blue-700">
                            <Link href={`/portal/dashboard/notas/turmas/${item.id}/editar`}>
                              <Pencil className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            size="icon-sm"
                            title={isEs ? "Eliminar turma" : "Excluir turma"}
                            aria-label={isEs ? "Eliminar turma" : "Excluir turma"}
                            onClick={() => deleteClass(item.id)}
                            disabled={deleting}
                            className="bg-rose-600 hover:bg-rose-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

