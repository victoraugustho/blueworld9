"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, GraduationCap, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TURMA_YEAR_OPTIONS } from "@/lib/turma-years"
import NotasSectionNav from "../../_components/NotasSectionNav"

type Locale = "pt-BR" | "es"

type TeacherOption = {
  id: string
  name: string
  email: string
}

export default function NovaTurmaClient({
  locale,
  defaultTeacherId,
}: {
  locale: Locale
  defaultTeacherId: string
}) {
  const router = useRouter()
  const isEs = locale === "es"

  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [teacherId, setTeacherId] = useState(defaultTeacherId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [studentYear, setStudentYear] = useState("")
  const [schoolYear, setSchoolYear] = useState<number>(new Date().getFullYear())
  const [active, setActive] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadTeachers() {
      setLoadingTeachers(true)
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

      if (!mounted) return
      setTeachers(mapped)
      if (!teacherId && mapped.length > 0) {
        setTeacherId(mapped[0].id)
      }
      setLoadingTeachers(false)
    }

    loadTeachers().catch(() => {
      if (!mounted) return
      setError(isEs ? "No se pudo cargar los profesores." : "Nao foi possivel carregar os professores.")
      setLoadingTeachers(false)
    })

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createClass(e: React.FormEvent) {
    e.preventDefault()
    const cleanName = name.trim()
    if (!cleanName || !teacherId) return

    setSaving(true)
    setError("")
    const res = await fetch("/api/portal/gradebook/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacher_id: teacherId,
        name: cleanName,
        student_year: studentYear || null,
        school_year: schoolYear,
        active,
      }),
    })
    const data = await res.json().catch(() => null)
    setSaving(false)

    if (!res.ok) {
      setError(isEs ? "No se pudo crear la turma." : "Nao foi possivel criar a turma.")
      return
    }

    const id = String(data?.id ?? "")
    if (id) {
      router.push(`/portal/dashboard/notas/turmas/${id}/editar`)
      return
    }

    router.push("/portal/dashboard/notas/turmas")
  }

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GraduationCap className="w-7 h-7 text-cyan-300" />
          {isEs ? "Nueva Turma" : "Nova Turma"}
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          {isEs
            ? "Pantalla separada para crear turma."
            : "Tela separada para criacao de turma."}
        </p>
      </div>

      <NotasSectionNav locale={locale} />

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">{isEs ? "Datos de la Turma" : "Dados da Turma"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createClass} className="space-y-4 max-w-2xl">
            <div>
              <Label className="text-white">{isEs ? "Profesor" : "Professor"}</Label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(String(e.target.value))}
                className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
                disabled={loadingTeachers}
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

            <div>
              <Label className="text-white">{isEs ? "Nombre" : "Nome"}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 bg-slate-800/70 border-slate-700 text-white"
                placeholder={isEs ? "Ej: Turma 7A" : "Ex: Turma 7A"}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-white">{isEs ? "Ano de turma" : "Ano da turma"}</Label>
                <select
                  value={studentYear}
                  onChange={(e) => setStudentYear(e.target.value)}
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
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(Number(e.target.value || new Date().getFullYear()))}
                  className="mt-1 bg-slate-800/70 border-slate-700 text-white"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              {isEs ? "Turma activa" : "Turma ativa"}
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={saving || loadingTeachers || !teacherId || !name.trim()}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving
                  ? isEs
                    ? "Guardando..."
                    : "Salvando..."
                  : isEs
                    ? "Crear y abrir edicion"
                    : "Criar e abrir edicao"}
              </Button>

              <Button asChild type="button" className="bg-white/10 hover:bg-white/15 border border-white/10">
                <Link href="/portal/dashboard/notas/turmas">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {isEs ? "Volver" : "Voltar"}
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

