"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CalendarDays,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react"
import type { Teacher, TeacherClass, TeacherClassStudent, TeacherSchedule } from "@/app/types/portal"
import { TIMEZONE_OPTIONS, getDefaultTimezone, getTimezoneLabel } from "@/lib/timezones"
import { TURMA_YEAR_OPTIONS } from "@/lib/turma-years"

type TeacherGroupResponse = {
  approved: Teacher[]
  pending: Teacher[]
  disabled: Teacher[]
}

const weekdayOptions = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terca-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sabado" },
  { value: 7, label: "Domingo" },
]

const weekdayLabelMap: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terca-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sabado",
  7: "Domingo",
}

function weekdayLabel(value: number) {
  return weekdayLabelMap[value] ?? `Dia ${value}`
}

function timeLabel(value: string) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

function timeToMinutes(value: string) {
  const [hRaw, mRaw] = String(value ?? "").split(":")
  const h = Number(hRaw ?? 0)
  const m = Number(mRaw ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return Math.max(0, h * 60 + m)
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const normalized = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ""
  if (!normalized) return value
  const date = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

const turmaYearLabelMap = new Map<number, string>(
  TURMA_YEAR_OPTIONS.map((item) => [item.value, item.label]),
)

function studentYearLabel(value?: number | null) {
  if (value === null || value === undefined) return "Sem ano"
  return turmaYearLabelMap.get(value) ?? `Ano ${value}`
}

function compareStudentNames(a: string, b: string) {
  return String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", {
    sensitivity: "base",
    ignorePunctuation: true,
  })
}

type ScheduleForm = {
  teacher_id: string
  class_id: string
  class_label: string
  entry_type: "class" | "event"
  is_recurring: boolean
  event_date: string
  weekday: number
  start_time: string
  end_time: string
  timezone: string
  active: boolean
}

type StudentDraft = {
  full_name: string
  enrollment_code: string
  active: boolean
}

export default function AdminSchedulesPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("")
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([])
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [activeSection, setActiveSection] = useState<"classes" | "students" | "agenda-form" | "agenda-view">(
    "classes",
  )
  const [loading, setLoading] = useState(true)
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [creatingClass, setCreatingClass] = useState(false)
  const [deletingClassId, setDeletingClassId] = useState("")
  const [classError, setClassError] = useState("")
  const [classSearch, setClassSearch] = useState("")
  const [scheduleSearch, setScheduleSearch] = useState("")
  const [newClassName, setNewClassName] = useState("")
  const [newClassStudentYear, setNewClassStudentYear] = useState("")
  const [newClassSchoolYear, setNewClassSchoolYear] = useState<number>(new Date().getFullYear())
  const [newClassActive, setNewClassActive] = useState(true)
  const [studentsClassId, setStudentsClassId] = useState("")
  const [classStudents, setClassStudents] = useState<TeacherClassStudent[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState("")
  const [newStudentName, setNewStudentName] = useState("")
  const [newStudentEnrollment, setNewStudentEnrollment] = useState("")
  const [bulkStudents, setBulkStudents] = useState("")
  const [importingStudents, setImportingStudents] = useState(false)
  const [addingStudent, setAddingStudent] = useState(false)
  const [studentSavingId, setStudentSavingId] = useState("")
  const [studentDeletingId, setStudentDeletingId] = useState("")
  const [studentDrafts, setStudentDrafts] = useState<Record<string, StudentDraft>>({})

  const [form, setForm] = useState<ScheduleForm>({
    teacher_id: "",
    class_id: "",
    class_label: "",
    entry_type: "class",
    is_recurring: true,
    event_date: "",
    weekday: 1,
    start_time: "10:00",
    end_time: "10:55",
    timezone: "",
    active: true,
  })

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) ?? null,
    [teachers, selectedTeacherId],
  )

  const scheduleDays = [1, 2, 3, 4, 5]
  const filteredSchedules = useMemo(() => {
    const query = scheduleSearch.trim().toLowerCase()
    if (!query) return schedules
    return schedules.filter((item) => {
      const label = String(item.class_label ?? "").toLowerCase()
      const day = weekdayLabel(item.weekday).toLowerCase()
      const date = formatDate(item.event_date).toLowerCase()
      const start = timeLabel(item.start_time)
      const end = timeLabel(item.end_time)
      return (
        label.includes(query) ||
        day.includes(query) ||
        date.includes(query) ||
        start.includes(query) ||
        end.includes(query)
      )
    })
  }, [scheduleSearch, schedules])

  const recurringByWeekday = useMemo(() => {
    const map: Record<number, TeacherSchedule[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    for (const schedule of filteredSchedules) {
      if (schedule.is_recurring === false) continue
      if (map[schedule.weekday]) map[schedule.weekday].push(schedule)
    }
    for (const day of scheduleDays) {
      map[day].sort((a, b) => timeLabel(a.start_time).localeCompare(timeLabel(b.start_time)))
    }
    return map
  }, [filteredSchedules])

  const oneOffEvents = useMemo(
    () =>
      filteredSchedules
        .filter((item) => item.is_recurring === false)
        .sort((a, b) => String(a.event_date ?? "").localeCompare(String(b.event_date ?? ""))),
    [filteredSchedules],
  )

  const timezoneOptions = useMemo(() => {
    if (!selectedTeacher) return []
    return TIMEZONE_OPTIONS[selectedTeacher.country] ?? []
  }, [selectedTeacher])

  const classMap = useMemo(() => {
    const map = new Map<string, TeacherClass>()
    for (const item of teacherClasses) map.set(item.id, item)
    return map
  }, [teacherClasses])

  const sortedStudents = useMemo(
    () =>
      [...classStudents].sort((a, b) =>
        compareStudentNames(String(a.full_name ?? ""), String(b.full_name ?? "")),
      ),
    [classStudents],
  )

  const filteredTeacherClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase()
    const list = [...teacherClasses].sort((a, b) => {
      const schoolYearDiff = Number(b.school_year ?? 0) - Number(a.school_year ?? 0)
      if (schoolYearDiff !== 0) return schoolYearDiff
      return String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR")
    })

    if (!query) return list

    return list.filter((item) => {
      const name = String(item.name ?? "").toLowerCase()
      const schoolYear = String(item.school_year ?? "")
      const studentYear = studentYearLabel(item.student_year).toLowerCase()
      return name.includes(query) || schoolYear.includes(query) || studentYear.includes(query)
    })
  }, [classSearch, teacherClasses])

  const totalClassStudents = useMemo(
    () => teacherClasses.reduce((acc, item) => acc + Number(item.student_count ?? 0), 0),
    [teacherClasses],
  )

  const classHasStudentsForConversion = useMemo(() => {
    if (!editingId) return false
    if (!form.class_id) return false
    const classRow = teacherClasses.find((item) => item.id === form.class_id)
    if (Number(classRow?.student_count ?? 0) > 0) return true
    if (studentsClassId !== form.class_id) return false
    return classStudents.length > 0
  }, [editingId, form.class_id, studentsClassId, classStudents.length, teacherClasses])

  async function loadTeachers() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/teachers", { cache: "no-store" })
      const data: TeacherGroupResponse = await res.json()
      const list = Array.isArray(data?.approved) ? data.approved : []
      list.sort((a, b) => a.name.localeCompare(b.name))
      setTeachers(list)
      if (!selectedTeacherId && list.length > 0) {
        setSelectedTeacherId(list[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadSchedules(teacherId: string) {
    if (!teacherId) return
    setLoadingSchedules(true)
    try {
      const res = await fetch(`/api/admin/teacher-schedules?teacherId=${teacherId}`, { cache: "no-store" })
      const data = await res.json()
      setSchedules(Array.isArray(data) ? data : [])
    } finally {
      setLoadingSchedules(false)
    }
  }

  async function loadTeacherClasses(teacherId: string) {
    if (!teacherId) {
      setTeacherClasses([])
      return
    }
    const res = await fetch(
      `/api/portal/gradebook/classes?teacherId=${teacherId}&allYears=1`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => [])
    setTeacherClasses(Array.isArray(data) ? data : [])
  }

  async function loadClassStudents(classId: string) {
    if (!classId) {
      setClassStudents([])
      setStudentDrafts({})
      setStudentsError("")
      return
    }

    setStudentsLoading(true)
    setStudentsError("")
    const res = await fetch(`/api/portal/gradebook/classes/${classId}/students`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => [])
    setStudentsLoading(false)

    if (!res.ok) {
      setClassStudents([])
      setStudentDrafts({})
      setStudentsError(String(data?.error ?? "Erro ao carregar alunos"))
      return
    }

    const list = Array.isArray(data) ? (data as TeacherClassStudent[]) : []
    setClassStudents(list)
    const drafts: Record<string, StudentDraft> = {}
    for (const student of list) {
      drafts[student.id] = {
        full_name: String(student.full_name ?? ""),
        enrollment_code: String(student.enrollment_code ?? ""),
        active: student.active === true,
      }
    }
    setStudentDrafts(drafts)
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault()
    const teacherId = selectedTeacherId.trim()
    const className = newClassName.trim()
    if (!teacherId || !className) return

    setCreatingClass(true)
    setClassError("")

    const endpoint = editingClassId
      ? `/api/portal/gradebook/classes/${editingClassId}`
      : "/api/portal/gradebook/classes"
    const method = editingClassId ? "PUT" : "POST"

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacher_id: teacherId,
        name: className,
        student_year: newClassStudentYear || null,
        school_year: newClassSchoolYear,
        active: newClassActive,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setCreatingClass(false)

    if (!res.ok) {
      setClassError(String(data?.error ?? "Erro ao salvar turma"))
      return
    }

    const affectedClassId = editingClassId ? editingClassId : String(data?.id ?? "")
    await loadTeacherClasses(teacherId)
    await loadSchedules(teacherId)
    if (affectedClassId) {
      setForm((prev) => ({
        ...prev,
        teacher_id: teacherId,
        entry_type: "class",
        class_id: affectedClassId,
      }))
      setStudentsClassId(affectedClassId)
    }
    resetClassForm()
    setActiveSection("students")
  }

  function resetClassForm() {
    setEditingClassId(null)
    setNewClassName("")
    setNewClassStudentYear("")
    setNewClassSchoolYear(new Date().getFullYear())
    setNewClassActive(true)
    setClassError("")
  }

  function startEditClass(item: TeacherClass) {
    setEditingClassId(item.id)
    setNewClassName(String(item.name ?? ""))
    setNewClassStudentYear(
      item.student_year === null || item.student_year === undefined ? "" : String(item.student_year),
    )
    setNewClassSchoolYear(Number(item.school_year ?? new Date().getFullYear()))
    setNewClassActive(item.active === true)
    setClassError("")
    setActiveSection("classes")
  }

  async function handleDeleteClass(item: TeacherClass) {
    const studentCount = Number(item.student_count ?? 0)
    const warningMessage =
      studentCount > 0
        ? `Esta turma possui ${studentCount} aluno(s). Excluir tambem remove lancamentos, notas e agenda vinculados. Deseja continuar?`
        : "Deseja excluir esta turma?"

    if (!confirm(warningMessage)) return

    setDeletingClassId(item.id)
    setClassError("")

    const res = await fetch(`/api/portal/gradebook/classes/${item.id}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))

    setDeletingClassId("")

    if (!res.ok) {
      setClassError(String(data?.error ?? "Erro ao excluir turma"))
      return
    }

    await loadTeacherClasses(selectedTeacherId)
    await loadSchedules(selectedTeacherId)

    if (studentsClassId === item.id) {
      setStudentsClassId("")
      setClassStudents([])
      setStudentDrafts({})
    }

    if (form.class_id === item.id) {
      setForm((prev) => ({ ...prev, class_id: "" }))
    }

    if (editingClassId === item.id) {
      resetClassForm()
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    const classId = studentsClassId.trim()
    const fullName = newStudentName.trim()
    if (!classId || !fullName) return

    setAddingStudent(true)
    setStudentsError("")
    const res = await fetch(`/api/portal/gradebook/classes/${classId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        enrollment_code: newStudentEnrollment.trim() || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setAddingStudent(false)

    if (!res.ok) {
      setStudentsError(String(data?.error ?? "Erro ao adicionar aluno"))
      return
    }

    setNewStudentName("")
    setNewStudentEnrollment("")
    await loadClassStudents(classId)
    await loadTeacherClasses(selectedTeacherId)
  }

  async function handleImportStudents() {
    const classId = studentsClassId.trim()
    if (!classId) return

    const lines = bulkStudents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) return

    const studentsPayload = lines
      .map((line) => {
        const [fullNameRaw, enrollmentRaw] = line.split(";")
        const fullName = String(fullNameRaw ?? "").trim()
        const enrollment = String(enrollmentRaw ?? "").trim()
        if (!fullName) return null
        return {
          full_name: fullName,
          enrollment_code: enrollment || null,
        }
      })
      .filter((item): item is { full_name: string; enrollment_code: string | null } => Boolean(item))
      .sort((a, b) => compareStudentNames(a.full_name, b.full_name))

    if (studentsPayload.length === 0) return

    setImportingStudents(true)
    setStudentsError("")
    const res = await fetch(`/api/portal/gradebook/classes/${classId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students: studentsPayload }),
    })
    const data = await res.json().catch(() => ({}))
    setImportingStudents(false)

    if (!res.ok) {
      setStudentsError(String(data?.error ?? "Erro ao importar alunos"))
      return
    }

    setBulkStudents("")
    await loadClassStudents(classId)
    await loadTeacherClasses(selectedTeacherId)
  }

  async function handleSaveStudent(studentId: string) {
    const draft = studentDrafts[studentId]
    if (!draft || !draft.full_name.trim()) return

    setStudentSavingId(studentId)
    setStudentsError("")
    const res = await fetch(`/api/portal/gradebook/students/${studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: draft.full_name.trim(),
        enrollment_code: draft.enrollment_code.trim() || null,
        active: draft.active,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setStudentSavingId("")

    if (!res.ok) {
      setStudentsError(String(data?.error ?? "Erro ao salvar aluno"))
      return
    }

    await loadClassStudents(studentsClassId)
  }

  async function handleDeleteStudent(studentId: string) {
    const ok = confirm("Deseja excluir este aluno da turma?")
    if (!ok) return

    setStudentDeletingId(studentId)
    setStudentsError("")
    const res = await fetch(`/api/portal/gradebook/students/${studentId}`, {
      method: "DELETE",
    })
    const data = await res.json().catch(() => ({}))
    setStudentDeletingId("")

    if (!res.ok) {
      setStudentsError(String(data?.error ?? "Erro ao excluir aluno"))
      return
    }

    await loadClassStudents(studentsClassId)
    await loadTeacherClasses(selectedTeacherId)
  }

  function toggleStudentDraftActive(studentId: string) {
    setStudentDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        active: !prev[studentId]?.active,
      },
    }))
  }

  function resetForm(forTeacher = selectedTeacher) {
    const tz = forTeacher ? getDefaultTimezone(forTeacher.country) : ""
    setForm({
      teacher_id: forTeacher?.id ?? "",
      class_id: "",
      class_label: "",
      entry_type: "class",
      is_recurring: true,
      event_date: "",
      weekday: 1,
      start_time: "10:00",
      end_time: "10:55",
      timezone: tz,
      active: true,
    })
  }

  useEffect(() => {
    loadTeachers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedTeacherId) return
    setEditingId(null)
    resetClassForm()
    setStudentsClassId("")
    setClassStudents([])
    setStudentDrafts({})
    setStudentsError("")
    setNewStudentName("")
    setNewStudentEnrollment("")
    setBulkStudents("")
    setClassSearch("")
    setScheduleSearch("")
    setActiveSection("classes")
    resetForm(selectedTeacher)
    loadSchedules(selectedTeacherId)
    loadTeacherClasses(selectedTeacherId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacherId])

  useEffect(() => {
    if (teacherClasses.length === 0) {
      setStudentsClassId("")
      setClassStudents([])
      setStudentDrafts({})
      return
    }

    setStudentsClassId((prev) => {
      if (prev && teacherClasses.some((item) => item.id === prev)) return prev
      return teacherClasses[0]?.id ?? ""
    })
  }, [teacherClasses])

  useEffect(() => {
    if (!studentsClassId) return
    loadClassStudents(studentsClassId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsClassId])

  function startEdit(item: TeacherSchedule) {
    setEditingId(item.id)
    setActiveSection("agenda-form")
    if (item.class_id) {
      setStudentsClassId(String(item.class_id))
    }
    setForm({
      teacher_id: item.teacher_id,
      class_id: item.class_id ? String(item.class_id) : "",
      class_label: item.class_label,
      entry_type: item.entry_type === "event" ? "event" : "class",
      is_recurring: item.is_recurring !== false,
      event_date: String(item.event_date ?? ""),
      weekday: item.weekday,
      start_time: timeLabel(item.start_time),
      end_time: timeLabel(item.end_time),
      timezone: item.timezone,
      active: item.active,
    })
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir este item da agenda?")) return
    const res = await fetch(`/api/admin/teacher-schedules/${id}`, { method: "DELETE" })
    if (res.ok) {
      if (editingId === id) {
        setEditingId(null)
        resetForm(selectedTeacher)
      }
      loadSchedules(selectedTeacherId)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.teacher_id) return

    const classRow = form.class_id ? classMap.get(form.class_id) : null
    const payload = {
      ...form,
      class_label:
        form.entry_type === "class"
          ? String(classRow?.name ?? form.class_label ?? "").trim()
          : String(form.class_label ?? "").trim(),
    }

    const url = editingId
      ? `/api/admin/teacher-schedules/${editingId}`
      : "/api/admin/teacher-schedules"
    const method = editingId ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao salvar")
      return
    }

    setEditingId(null)
    resetForm(selectedTeacher)
    loadSchedules(selectedTeacherId)
  }

  return (
    <div className="p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-cyan-300" />
            Agenda de Professores
          </h1>
          <p className="text-slate-400 text-sm">
            Turmas e eventos (recorrentes ou pontuais) no mesmo calendario.
          </p>
        </div>

        <Button
          onClick={() => loadSchedules(selectedTeacherId)}
          className="bg-white/10 hover:bg-white/15 border border-white/10"
          disabled={loadingSchedules}
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${loadingSchedules ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-6">
        <Card className="bg-slate-900/40 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Professor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-slate-400 text-sm">Carregando...</p>}
            {!loading && teachers.length === 0 && (
              <p className="text-slate-400 text-sm">Nenhum professor aprovado.</p>
            )}

            {teachers.length > 0 && (
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id} className="text-white">
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            {selectedTeacher && (
              <div className="text-xs text-slate-400 space-y-1">
                <div>{selectedTeacher.email}</div>
                <div>{`Pais: ${selectedTeacher.country}`}</div>
                <div>{`Idioma: ${selectedTeacher.locale}`}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/30 backdrop-blur-sm p-2">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { id: "classes", label: "1. Turmas" },
                { id: "students", label: "2. Alunos" },
                { id: "agenda-form", label: "3. Cadastro da Agenda" },
                { id: "agenda-view", label: "4. Visualizacao" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setActiveSection(item.id as "classes" | "students" | "agenda-form" | "agenda-view")
                  }
                  className={`px-3 py-2 rounded-lg border text-sm transition ${
                    activeSection === item.id
                      ? "bg-cyan-600 border-cyan-500 text-white"
                      : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/30 backdrop-blur-sm px-3 py-2">
              <p className="text-[11px] text-slate-400">Turmas</p>
              <p className="text-lg font-semibold text-white">{teacherClasses.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/30 backdrop-blur-sm px-3 py-2">
              <p className="text-[11px] text-slate-400">Alunos cadastrados</p>
              <p className="text-lg font-semibold text-white">{totalClassStudents}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/30 backdrop-blur-sm px-3 py-2">
              <p className="text-[11px] text-slate-400">Itens na agenda</p>
              <p className="text-lg font-semibold text-white">{schedules.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/30 backdrop-blur-sm px-3 py-2">
              <p className="text-[11px] text-slate-400">Professor selecionado</p>
              <p className="text-sm font-semibold text-white truncate">{selectedTeacher?.name ?? "-"}</p>
            </div>
          </div>
          {activeSection === "classes" && (
          <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-cyan-300" />
                {editingClassId ? "Editar turma" : "Criar Turma (Agenda + Notas)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateClass} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">Nome da turma</label>
                  <input
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Ex: 7A Manha"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Ano da turma (opcional)</label>
                  <select
                    value={newClassStudentYear}
                    onChange={(e) => setNewClassStudentYear(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  >
                    <option value="">Sem ano</option>
                    {TURMA_YEAR_OPTIONS.map((item) => (
                      <option key={item.value} value={String(item.value)}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Ano letivo</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={newClassSchoolYear}
                    onChange={(e) =>
                      setNewClassSchoolYear(Number(e.target.value || new Date().getFullYear()))
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    id="class-active"
                    type="checkbox"
                    checked={newClassActive}
                    onChange={(e) => setNewClassActive(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  <label htmlFor="class-active" className="text-sm text-white/80">
                    Turma ativa
                  </label>
                </div>

                {classError ? (
                  <p className="md:col-span-2 text-xs text-rose-300">{classError}</p>
                ) : null}

                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    className="bg-cyan-600 hover:bg-cyan-700"
                    disabled={creatingClass || !selectedTeacherId || !newClassName.trim()}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {creatingClass
                      ? editingClassId
                        ? "Salvando..."
                        : "Criando..."
                      : editingClassId
                        ? "Salvar turma"
                        : "Criar turma para este professor"}
                  </Button>
                  {editingClassId ? (
                    <Button
                      type="button"
                      onClick={resetClassForm}
                      className="bg-white/10 hover:bg-white/15 border border-white/10"
                    >
                      Cancelar edicao
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>
          )}

          {activeSection === "classes" && (
            <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-300" />
                  Turmas cadastradas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
                  <input
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    placeholder="Buscar turma por nome, ano ou ano letivo"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                  <Button
                    type="button"
                    onClick={() => setClassSearch("")}
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                    disabled={!classSearch.trim()}
                  >
                    Limpar busca
                  </Button>
                </div>

                {filteredTeacherClasses.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma turma encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredTeacherClasses.map((item) => {
                      const isDeleting = deletingClassId === item.id
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2 flex items-center justify-between gap-3 flex-wrap"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{item.name}</p>
                            <p className="text-xs text-slate-300">
                              {studentYearLabel(item.student_year)} | {item.school_year} |{" "}
                              {item.student_count ?? 0} aluno(s)
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              type="button"
                              size="icon-sm"
                              title="Editar turma"
                              aria-label="Editar turma"
                              onClick={() => startEditClass(item)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              title="Gerenciar alunos"
                              aria-label="Gerenciar alunos"
                              onClick={() => {
                                setStudentsClassId(item.id)
                                setActiveSection("students")
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Users className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              title="Usar na agenda"
                              aria-label="Usar na agenda"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  teacher_id: selectedTeacherId,
                                  entry_type: "class",
                                  class_id: item.id,
                                  is_recurring: true,
                                  event_date: "",
                                }))
                                setStudentsClassId(item.id)
                                setActiveSection("agenda-form")
                              }}
                              className="bg-cyan-600 hover:bg-cyan-700"
                            >
                              <CalendarDays className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              title="Excluir turma"
                              aria-label="Excluir turma"
                              onClick={() => handleDeleteClass(item)}
                              disabled={isDeleting}
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
          )}

          {activeSection === "students" && (
          <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-300" />
                Gerenciar Alunos da Turma
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Turma para organizar alunos</label>
                <select
                  value={studentsClassId}
                  onChange={(e) => setStudentsClassId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                >
                  <option value="">Selecione uma turma</option>
                  {teacherClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} | {item.school_year} | {item.student_count ?? 0} aluno(s)
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-[1fr,220px,auto] gap-3">
                <div>
                  <label className="text-xs text-slate-400">Nome do aluno</label>
                  <input
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                    placeholder="Ex: Joao Silva"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Matricula (opcional)</label>
                  <input
                    value={newStudentEnrollment}
                    onChange={(e) => setNewStudentEnrollment(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                    placeholder="Ex: 2026-001"
                  />
                </div>
                <div className="md:self-end">
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={addingStudent || !studentsClassId || !newStudentName.trim()}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {addingStudent ? "Adicionando..." : "Adicionar"}
                  </Button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Adicionar varios alunos (um por linha, opcional: Nome;Matricula)
                  </label>
                  <textarea
                    value={bulkStudents}
                    onChange={(e) => setBulkStudents(e.target.value)}
                    rows={5}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                    placeholder={"Ex:\nJoao Silva\nMaria Souza;2026-001"}
                  />
                </div>
                <div className="md:self-end">
                  <Button
                    type="button"
                    onClick={handleImportStudents}
                    className="bg-cyan-600 hover:bg-cyan-700"
                    disabled={importingStudents || !studentsClassId || !bulkStudents.trim()}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {importingStudents ? "Importando..." : "Importar linhas"}
                  </Button>
                </div>
              </div>

              {studentsError ? (
                <p className="text-xs text-rose-300">{studentsError}</p>
              ) : null}

              {studentsLoading ? (
                <p className="text-sm text-slate-300">Carregando alunos...</p>
              ) : !studentsClassId ? (
                <p className="text-sm text-slate-400">Selecione uma turma para visualizar alunos.</p>
              ) : sortedStudents.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum aluno cadastrado nesta turma.</p>
              ) : (
                <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-950/30">
                  {sortedStudents.map((student, index) => {
                    const draft = studentDrafts[student.id]
                    if (!draft) return null
                    const isSavingRow = studentSavingId === student.id
                    const isDeletingRow = studentDeletingId === student.id

                    return (
                      <div
                        key={student.id}
                        className="px-3 md:px-4 py-2.5 border-b border-white/10 last:border-b-0 flex flex-col gap-2 md:grid md:grid-cols-[32px,1fr,220px,auto] md:items-center"
                      >
                        <span className="text-xs text-slate-400">{index + 1}</span>
                        <input
                          value={draft.full_name}
                          onChange={(e) =>
                            setStudentDrafts((prev) => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], full_name: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                          placeholder="Nome do aluno"
                        />
                        <input
                          value={draft.enrollment_code}
                          onChange={(e) =>
                            setStudentDrafts((prev) => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], enrollment_code: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                          placeholder="Matricula"
                        />
                        <div className="flex items-center justify-start md:justify-end gap-2">
                          <Button
                            size="icon-sm"
                            title={draft.active ? "Aluno ativo" : "Aluno inativo"}
                            aria-label={draft.active ? "Aluno ativo" : "Aluno inativo"}
                            onClick={() => toggleStudentDraftActive(student.id)}
                            className={draft.active ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-600"}
                          >
                            {draft.active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </Button>

                          <Button
                            size="icon-sm"
                            title="Salvar aluno"
                            aria-label="Salvar aluno"
                            onClick={() => handleSaveStudent(student.id)}
                            disabled={isSavingRow || !draft.full_name.trim()}
                            className="bg-cyan-600 hover:bg-cyan-700"
                          >
                            <Save className="w-4 h-4" />
                          </Button>

                          <Button
                            size="icon-sm"
                            title="Excluir aluno"
                            aria-label="Excluir aluno"
                            onClick={() => handleDeleteStudent(student.id)}
                            disabled={isDeletingRow}
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
          )}

          {activeSection === "agenda-form" && (
          <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white text-base">
                {editingId ? "Editar item da agenda" : "Adicionar item da agenda"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, entry_type: "class", is_recurring: true, event_date: "" }))}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${
                      form.entry_type === "class"
                        ? "bg-cyan-600 border-cyan-500 text-white"
                        : "bg-white/5 border-white/15 text-white/80"
                    }`}
                  >
                    Turma
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (classHasStudentsForConversion) return
                      setForm((prev) => ({ ...prev, entry_type: "event", class_id: "" }))
                    }}
                    disabled={classHasStudentsForConversion}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${
                      form.entry_type === "event"
                        ? "bg-cyan-600 border-cyan-500 text-white"
                        : "bg-white/5 border-white/15 text-white/80"
                    } ${classHasStudentsForConversion ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Evento
                  </button>
                </div>

                {classHasStudentsForConversion ? (
                  <p className="md:col-span-2 text-xs text-amber-300">
                    Nao e possivel transformar esta turma em evento enquanto houver alunos cadastrados.
                  </p>
                ) : null}

                {form.entry_type === "class" ? (
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-400">Turma</label>
                    <select
                      value={form.class_id}
                      onChange={(e) => {
                        const value = e.target.value
                        setForm((prev) => ({ ...prev, class_id: value }))
                        if (value) setStudentsClassId(value)
                      }}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                    >
                      <option value="">Selecione uma turma</option>
                      {teacherClasses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} | {item.school_year} | {item.student_count ?? 0} aluno(s)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-400">Titulo do evento</label>
                    <input
                      value={form.class_label}
                      onChange={(e) => setForm((prev) => ({ ...prev, class_label: e.target.value }))}
                      placeholder="Ex: Reuniao pedagogica"
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                    />
                  </div>
                )}

                {form.entry_type === "event" && (
                  <div className="md:col-span-2 flex items-center gap-2">
                    <input
                      id="event-recurring"
                      type="checkbox"
                      checked={form.is_recurring}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          is_recurring: e.target.checked,
                          event_date: e.target.checked ? "" : prev.event_date,
                        }))
                      }
                      className="rounded border-white/20"
                    />
                    <label htmlFor="event-recurring" className="text-sm text-white/80">
                      Evento recorrente semanal
                    </label>
                  </div>
                )}

                {(form.entry_type === "class" || form.is_recurring) && (
                  <div>
                    <label className="text-xs text-slate-400">Dia da semana</label>
                    <select
                      value={form.weekday}
                      onChange={(e) => setForm((prev) => ({ ...prev, weekday: Number(e.target.value) }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                    >
                      {weekdayOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {form.entry_type === "event" && !form.is_recurring && (
                  <div>
                    <label className="text-xs text-slate-400">Data do evento</label>
                    <input
                      type="date"
                      value={form.event_date}
                      onChange={(e) => setForm((prev) => ({ ...prev, event_date: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-400">Inicio</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Fim</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Fuso horario</label>
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  >
                    {timezoneOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-6 md:mt-7">
                  <input
                    id="schedule-active"
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <label htmlFor="schedule-active" className="text-sm text-white/80">
                    Ativo
                  </label>
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                    {editingId ? "Salvar" : "Adicionar"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        resetForm(selectedTeacher)
                      }}
                      className="bg-white/10 hover:bg-white/15 border border-white/10"
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => setActiveSection("agenda-view")}
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                  >
                    Ver agenda
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          )}

          {activeSection === "agenda-view" && (
          <Card className="bg-slate-900/30 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white text-base">Agenda do professor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
                <input
                  value={scheduleSearch}
                  onChange={(e) => setScheduleSearch(e.target.value)}
                  placeholder="Buscar por turma, evento, dia, data ou horario"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                />
                <Button
                  type="button"
                  onClick={() => setScheduleSearch("")}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                  disabled={!scheduleSearch.trim()}
                >
                  Limpar busca
                </Button>
              </div>

              {loadingSchedules && <p className="text-slate-400">Carregando...</p>}
              {!loadingSchedules && filteredSchedules.length === 0 && (
                <p className="text-slate-400">Nenhum item encontrado.</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2.5">
                {scheduleDays.map((day) => {
                  const list = recurringByWeekday[day] ?? []
                  const morningList = list.filter((item) => timeToMinutes(item.start_time) < 12 * 60)
                  const afternoonList = list.filter((item) => timeToMinutes(item.start_time) >= 12 * 60)
                  const periodSections = [
                    {
                      key: "morning",
                      label: "Matutino",
                      items: morningList,
                      panelClass: "border-amber-400/30 bg-amber-500/12",
                      chipClass: "text-amber-50 bg-amber-500/30 border border-amber-300/35",
                      emptyClass: "text-amber-100/75",
                      cardClass: "border-amber-300/25 bg-slate-900/50",
                      timeClass: "text-amber-100 bg-amber-500/20 border border-amber-300/35",
                    },
                    {
                      key: "afternoon",
                      label: "Vespertino",
                      items: afternoonList,
                      panelClass: "border-sky-400/30 bg-sky-500/12",
                      chipClass: "text-sky-50 bg-sky-500/30 border border-sky-300/35",
                      emptyClass: "text-sky-100/75",
                      cardClass: "border-sky-300/25 bg-slate-900/50",
                      timeClass: "text-sky-100 bg-sky-500/20 border border-sky-300/35",
                    },
                  ] as const
                  return (
                    <div key={day} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="px-2.5 py-1.5 border-b border-white/10 text-[11px] font-semibold text-white/80">
                        {weekdayLabel(day)}
                      </div>
                      <div className="p-2 space-y-2">
                        {list.length === 0 && (
                          <p className="text-xs text-slate-400">Sem itens</p>
                        )}
                        {list.length > 0 &&
                          periodSections.map((section) => (
                            <div key={section.key} className={`rounded-lg border p-1.5 space-y-1.5 ${section.panelClass}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${section.chipClass}`}>
                                  {section.label}
                                </span>
                                <span className="text-[10px] text-white/80 font-semibold">{section.items.length}</span>
                              </div>
                              {section.items.length === 0 ? (
                                <p className={`px-1 pb-0.5 text-xs ${section.emptyClass}`}>Sem itens</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {section.items.map((schedule) => (
                                    <div
                                      key={schedule.id}
                                      className={`rounded-md border p-2 space-y-1.5 ${section.cardClass}`}
                                    >
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="text-xs font-semibold text-white truncate max-w-[14rem] sm:max-w-none">
                                          {schedule.class_label}
                                        </p>
                                        <span
                                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                            schedule.entry_type === "event"
                                              ? "text-amber-100 bg-amber-500/20 border-amber-400/30"
                                              : "text-cyan-100 bg-cyan-500/20 border-cyan-500/30"
                                          }`}
                                        >
                                          {schedule.entry_type === "event" ? "Evento" : "Turma"}
                                        </span>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${section.timeClass}`}>
                                          {timeLabel(schedule.start_time)} - {timeLabel(schedule.end_time)}
                                        </span>
                                      </div>

                                      <div className="text-[11px] text-white/60 truncate">
                                        {getTimezoneLabel(schedule.timezone)}
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => startEdit(schedule)}
                                          className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] rounded-md border border-blue-500/20 bg-blue-500/10 text-blue-200"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDelete(schedule.id)}
                                          className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-200"
                                        >
                                          <Trash className="w-3.5 h-3.5" />
                                          Excluir
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {oneOffEvents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">Eventos pontuais</h4>
                  {oneOffEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white">{event.class_label}</p>
                        <p className="text-xs text-white/60">
                          {formatDate(event.event_date)} | {timeLabel(event.start_time)} - {timeLabel(event.end_time)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(event)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-200"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(event.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  )
}
