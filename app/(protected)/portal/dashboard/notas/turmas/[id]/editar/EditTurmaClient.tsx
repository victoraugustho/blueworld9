"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, FilePlus2, Pencil, Save, Trash2, Upload, UserCheck, UserPlus, UserX, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TeacherClass, TeacherClassStudent } from "@/app/types/portal"
import { TURMA_YEAR_OPTIONS, getTurmaYearLabel } from "@/lib/turma-years"
import NotasSectionNav from "../../../_components/NotasSectionNav"

type Locale = "pt-BR" | "es"

type StudentDraft = {
  full_name: string
  enrollment_code: string
  active: boolean
}

type ClassDetail = TeacherClass & {
  active_student_count?: number
}

function compareStudentNames(a: string, b: string) {
  return String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", {
    sensitivity: "base",
    ignorePunctuation: true,
  })
}

export default function EditTurmaClient({
  locale,
  classId,
}: {
  locale: Locale
  classId: string
}) {
  const router = useRouter()
  const isEs = locale === "es"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [studentSavingId, setStudentSavingId] = useState("")
  const [studentDeletingId, setStudentDeletingId] = useState("")
  const [error, setError] = useState("")

  const [classData, setClassData] = useState<ClassDetail | null>(null)
  const [students, setStudents] = useState<TeacherClassStudent[]>([])
  const [studentDrafts, setStudentDrafts] = useState<Record<string, StudentDraft>>({})

  const [className, setClassName] = useState("")
  const [classStudentYear, setClassStudentYear] = useState("")
  const [classSchoolYear, setClassSchoolYear] = useState<number>(new Date().getFullYear())
  const [classActive, setClassActive] = useState(true)

  const [newStudentName, setNewStudentName] = useState("")
  const [newStudentEnrollment, setNewStudentEnrollment] = useState("")
  const [bulkStudents, setBulkStudents] = useState("")

  async function loadData() {
    setLoading(true)
    setError("")

    const [classRes, studentsRes] = await Promise.all([
      fetch(`/api/portal/gradebook/classes/${classId}`, { cache: "no-store" }),
      fetch(`/api/portal/gradebook/classes/${classId}/students`, { cache: "no-store" }),
    ])

    const classJson = await classRes.json().catch(() => null)
    const studentsJson = await studentsRes.json().catch(() => [])

    if (!classRes.ok) {
      setClassData(null)
      setStudents([])
      setError(isEs ? "No se pudo cargar la turma." : "Nao foi possivel carregar a turma.")
      setLoading(false)
      return
    }

    if (!studentsRes.ok) {
      setError(isEs ? "No se pudo cargar los alumnos." : "Nao foi possivel carregar os alunos.")
    }

    const parsedClass = classJson as ClassDetail
    const parsedStudents = Array.isArray(studentsJson) ? (studentsJson as TeacherClassStudent[]) : []

    setClassData(parsedClass)
    setClassName(String(parsedClass?.name ?? ""))
    setClassStudentYear(parsedClass?.student_year ? String(parsedClass.student_year) : "")
    setClassSchoolYear(Number(parsedClass?.school_year ?? new Date().getFullYear()))
    setClassActive(parsedClass?.active === true)

    setStudents(parsedStudents)

    const drafts: Record<string, StudentDraft> = {}
    for (const student of parsedStudents) {
      drafts[student.id] = {
        full_name: student.full_name,
        enrollment_code: student.enrollment_code ?? "",
        active: student.active === true,
      }
    }
    setStudentDrafts(drafts)

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

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => compareStudentNames(String(a.full_name), String(b.full_name))),
    [students],
  )

  async function saveClass() {
    if (!classData) return
    const cleanName = className.trim()
    if (!cleanName) return

    setSaving(true)
    setError("")
    const res = await fetch(`/api/portal/gradebook/classes/${classId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanName,
        student_year: classStudentYear || null,
        school_year: classSchoolYear,
        active: classActive,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      setError(isEs ? "No se pudo guardar la turma." : "Nao foi possivel salvar a turma.")
      return
    }

    await loadData()
  }

  async function deleteClass() {
    const ok = confirm(
      isEs
        ? "Eliminar esta turma y todos los datos de notas asociados?"
        : "Excluir esta turma e todos os dados de notas associados?",
    )
    if (!ok) return

    setSaving(true)
    setError("")
    const res = await fetch(`/api/portal/gradebook/classes/${classId}`, {
      method: "DELETE",
    })
    setSaving(false)

    if (!res.ok) {
      setError(isEs ? "No se pudo eliminar la turma." : "Nao foi possivel excluir a turma.")
      return
    }

    router.push("/portal/dashboard/notas/turmas")
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault()
    const fullName = newStudentName.trim()
    if (!fullName) return

    setSaving(true)
    setError("")
    const res = await fetch(`/api/portal/gradebook/classes/${classId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        enrollment_code: newStudentEnrollment.trim() || null,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      setError(isEs ? "No se pudo agregar el alumno." : "Nao foi possivel adicionar o aluno.")
      return
    }

    setNewStudentName("")
    setNewStudentEnrollment("")
    await loadData()
  }

  async function importStudents() {
    const lines = bulkStudents
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .sort((a, b) => compareStudentNames(a, b))

    if (lines.length === 0) return

    setSaving(true)
    setError("")
    const res = await fetch(`/api/portal/gradebook/classes/${classId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        students: lines.map((full_name) => ({ full_name })),
      }),
    })
    setSaving(false)

    if (!res.ok) {
      setError(isEs ? "No se pudo importar alumnos." : "Nao foi possivel importar alunos.")
      return
    }

    setBulkStudents("")
    await loadData()
  }

  async function saveStudent(studentId: string) {
    const draft = studentDrafts[studentId]
    if (!draft || !draft.full_name.trim()) return

    setStudentSavingId(studentId)
    setError("")
    const res = await fetch(`/api/portal/gradebook/students/${studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: draft.full_name.trim(),
        enrollment_code: draft.enrollment_code.trim() || null,
        active: draft.active,
      }),
    })
    setStudentSavingId("")

    if (!res.ok) {
      setError(isEs ? "No se pudo guardar el alumno." : "Nao foi possivel salvar o aluno.")
      return
    }

    await loadData()
  }

  async function deleteStudent(studentId: string) {
    const ok = confirm(isEs ? "Eliminar alumno?" : "Excluir aluno?")
    if (!ok) return

    setStudentDeletingId(studentId)
    setError("")
    const res = await fetch(`/api/portal/gradebook/students/${studentId}`, {
      method: "DELETE",
    })
    setStudentDeletingId("")

    if (!res.ok) {
      setError(isEs ? "No se pudo eliminar el alumno." : "Nao foi possivel excluir o aluno.")
      return
    }

    await loadData()
  }

  function toggleDraftActive(studentId: string) {
    setStudentDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        active: !prev[studentId]?.active,
      },
    }))
  }

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Pencil className="w-7 h-7 text-cyan-300" />
            {classData?.name || (isEs ? "Editar Turma" : "Editar Turma")}
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            {isEs
              ? "Edicion separada por pagina, con lista de alumnos por linea."
              : "Edicao separada por pagina, com lista de alunos por linha."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild className="bg-white/10 hover:bg-white/15 border border-white/10">
            <Link href={`/portal/dashboard/notas/turmas/${classId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isEs ? "Visualizar" : "Visualizar"}
            </Link>
          </Button>
          <Button asChild className="bg-white/10 hover:bg-white/15 border border-white/10">
            <Link href="/portal/dashboard/notas/turmas">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isEs ? "Listado" : "Listagem"}
            </Link>
          </Button>
        </div>
      </div>

      <NotasSectionNav locale={locale} />

      {loading ? (
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-300">{isEs ? "Cargando..." : "Carregando..."}</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && classData ? (
        <>
          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">{isEs ? "Datos de la turma" : "Dados da turma"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-white">{isEs ? "Nombre" : "Nome"}</Label>
                  <Input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="mt-1 bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white">{isEs ? "Ano de turma" : "Ano da turma"}</Label>
                  <select
                    value={classStudentYear}
                    onChange={(e) => setClassStudentYear(e.target.value)}
                    className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
                  >
                    <option value="">{isEs ? "Sin ano" : "Sem ano"}</option>
                    {TURMA_YEAR_OPTIONS.map((item) => (
                      <option key={item.value} value={String(item.value)}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-white">{isEs ? "Ano lectivo" : "Ano letivo"}</Label>
                  <Input
                    type="number"
                    value={classSchoolYear}
                    onChange={(e) => setClassSchoolYear(Number(e.target.value || new Date().getFullYear()))}
                    className="mt-1 bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-slate-200">
                  {classData.student_year ? getTurmaYearLabel(classData.student_year) : isEs ? "Sin ano" : "Sem ano"}
                </span>

                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={classActive}
                    onChange={(e) => setClassActive(e.target.checked)}
                  />
                  {isEs ? "Turma activa" : "Turma ativa"}
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={saveClass} disabled={saving || !className.trim()} className="bg-cyan-600 hover:bg-cyan-700">
                  <Save className="w-4 h-4 mr-2" />
                  {isEs ? "Guardar turma" : "Salvar turma"}
                </Button>
                <Button onClick={deleteClass} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isEs ? "Eliminar turma" : "Excluir turma"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-300" />
                {isEs ? "Agregar alumnos" : "Adicionar alunos"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addStudent} className="grid grid-cols-1 md:grid-cols-[1fr,220px,auto] gap-3">
                <div>
                  <Label className="text-white">{isEs ? "Alumno" : "Aluno"}</Label>
                  <Input
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="mt-1 bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">{isEs ? "Matricula" : "Matricula"}</Label>
                  <Input
                    value={newStudentEnrollment}
                    onChange={(e) => setNewStudentEnrollment(e.target.value)}
                    className="mt-1 bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>
                <div className="md:self-end">
                  <Button type="submit" disabled={saving || !newStudentName.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    {isEs ? "Agregar" : "Adicionar"}
                  </Button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
                <div>
                  <Label className="text-white">{isEs ? "Importar por lineas" : "Importar por linhas"}</Label>
                  <Textarea
                    value={bulkStudents}
                    onChange={(e) => setBulkStudents(e.target.value)}
                    className="mt-1 min-h-[96px] bg-slate-800/70 border-slate-700 text-white"
                    placeholder={isEs ? "Un alumno por linea" : "Um aluno por linha"}
                  />
                </div>
                <div className="md:self-end">
                  <Button onClick={importStudents} disabled={saving || !bulkStudents.trim()} className="bg-cyan-600 hover:bg-cyan-700">
                    <Upload className="w-4 h-4 mr-2" />
                    {isEs ? "Importar" : "Importar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-300" />
                {isEs ? "Alumnos por linea" : "Alunos por linha"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedStudents.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {isEs ? "No hay alumnos en esta turma." : "Nao ha alunos nesta turma."}
                </p>
              ) : (
                <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-950/30">
                  {sortedStudents.map((student, index) => {
                    const draft = studentDrafts[student.id]
                    if (!draft) return null

                    const isSavingStudent = studentSavingId === student.id
                    const isDeletingStudent = studentDeletingId === student.id

                    return (
                      <div
                        key={student.id}
                        className="px-3 md:px-4 py-2.5 border-b border-white/10 last:border-b-0 flex flex-col gap-2 md:grid md:grid-cols-[32px,1fr,220px,auto] md:items-center"
                      >
                        <span className="text-xs text-slate-400">{index + 1}</span>

                        <Input
                          value={draft.full_name}
                          onChange={(e) =>
                            setStudentDrafts((prev) => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], full_name: e.target.value },
                            }))
                          }
                          className="bg-slate-800/70 border-slate-700 text-white"
                          placeholder={isEs ? "Nombre del alumno" : "Nome do aluno"}
                        />

                        <Input
                          value={draft.enrollment_code}
                          onChange={(e) =>
                            setStudentDrafts((prev) => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], enrollment_code: e.target.value },
                            }))
                          }
                          className="bg-slate-800/70 border-slate-700 text-white"
                          placeholder={isEs ? "Matricula" : "Matricula"}
                        />

                        <div className="flex items-center justify-start md:justify-end gap-2">
                          <Button
                            size="icon-sm"
                            title={draft.active ? (isEs ? "Activo" : "Ativo") : (isEs ? "Inactivo" : "Inativo")}
                            aria-label={draft.active ? (isEs ? "Activo" : "Ativo") : (isEs ? "Inactivo" : "Inativo")}
                            onClick={() => toggleDraftActive(student.id)}
                            className={draft.active ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-600"}
                          >
                            {draft.active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </Button>

                          <Button
                            size="icon-sm"
                            title={isEs ? "Guardar alumno" : "Salvar aluno"}
                            aria-label={isEs ? "Guardar alumno" : "Salvar aluno"}
                            onClick={() => saveStudent(student.id)}
                            disabled={isSavingStudent || !draft.full_name.trim()}
                            className="bg-cyan-600 hover:bg-cyan-700"
                          >
                            <Save className="w-4 h-4" />
                          </Button>

                          <Button
                            size="icon-sm"
                            title={isEs ? "Eliminar alumno" : "Excluir aluno"}
                            aria-label={isEs ? "Eliminar alumno" : "Excluir aluno"}
                            onClick={() => deleteStudent(student.id)}
                            disabled={isDeletingStudent}
                            className="bg-rose-600 hover:bg-rose-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {!loading && !classData ? (
        <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <p className="text-sm text-slate-400">{isEs ? "Turma no encontrada." : "Turma nao encontrada."}</p>
              <Button asChild className="bg-white/10 hover:bg-white/15 border border-white/10">
                <Link href="/portal/dashboard/notas/turmas">
                  <FilePlus2 className="w-4 h-4 mr-2" />
                  {isEs ? "Volver al listado" : "Voltar para listagem"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

