"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, RefreshCcw, Trash2, Users, BookOpen, Link2, Layers, CalendarRange } from "lucide-react"
import type { Category, Teacher, TurmaYear } from "@/app/types/portal"

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

export default function AdminTurmasPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [yearGroups, setYearGroups] = useState<TurmaYear[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState("")
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")

  const [linkingCategoryId, setLinkingCategoryId] = useState<number | null>(null)
  const [loadingCategoryLinking, setLoadingCategoryLinking] = useState(false)
  const [savingCategoryLinking, setSavingCategoryLinking] = useState(false)
  const [categoryTeacherQuery, setCategoryTeacherQuery] = useState("")
  const [linkedCategoryTeacherIds, setLinkedCategoryTeacherIds] = useState<string[]>([])

  const [linkingYear, setLinkingYear] = useState<number | null>(null)
  const [loadingYearLinking, setLoadingYearLinking] = useState(false)
  const [savingYearLinking, setSavingYearLinking] = useState(false)
  const [yearTeacherQuery, setYearTeacherQuery] = useState("")
  const [linkedYearTeacherIds, setLinkedYearTeacherIds] = useState<string[]>([])

  async function loadAll() {
    setLoading(true)
    try {
      const [categoriesRes, teachersRes, yearsRes] = await Promise.all([
        fetch("/api/admin/categories", { cache: "no-store" }),
        fetch("/api/admin/teachers", { cache: "no-store" }),
        fetch("/api/admin/turmas/years", { cache: "no-store" }),
      ])

      const categoriesData = await categoriesRes.json().catch(() => [])
      const teachersData = await teachersRes.json().catch(() => ({}))
      const yearsData = await yearsRes.json().catch(() => [])
      const approvedTeachers = Array.isArray(teachersData?.approved) ? teachersData.approved : []

      setCategories(Array.isArray(categoriesData) ? categoriesData : [])
      setYearGroups(Array.isArray(yearsData) ? yearsData : [])
      setTeachers(approvedTeachers.sort((a: Teacher, b: Teacher) => a.name.localeCompare(b.name)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function createCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return

    const ok = confirm(`Confirmar criacao da categoria "${name}"?`)
    if (!ok) return

    setSaving(true)
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao criar categoria")
      return
    }

    setNewName("")
    await loadAll()
  }

  function startEdit(item: Category) {
    setEditingId(item.id)
    setEditingName(item.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName("")
  }

  async function saveEdit(item: Category) {
    const name = editingName.trim()
    if (!name || editingId !== item.id) return

    const ok = confirm(`Confirmar alteracao da categoria "${item.name}" para "${name}"?`)
    if (!ok) return

    setSaving(true)
    const res = await fetch(`/api/admin/categories/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao atualizar categoria")
      return
    }

    cancelEdit()
    await loadAll()
  }

  async function deleteCategory(item: Category) {
    const materialCount = Number(item.material_count ?? 0)
    const teacherCount = Number(item.teacher_count ?? 0)

    const warn = [
      `Tem certeza que deseja excluir a categoria "${item.name}"?`,
      `Materiais vinculados: ${materialCount}`,
      `Professores vinculados: ${teacherCount}`,
      "Essa acao vai remover os vinculos dessa categoria.",
    ].join("\n")

    const ok = confirm(warn)
    if (!ok) return

    setSaving(true)
    const res = await fetch(`/api/admin/categories/${item.id}`, { method: "DELETE" })
    setSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao excluir categoria")
      return
    }

    if (editingId === item.id) cancelEdit()
    if (linkingCategoryId === item.id) cancelCategoryLinking()
    await loadAll()
  }

  async function startCategoryLinking(item: Category) {
    setLinkingCategoryId(item.id)
    setCategoryTeacherQuery("")
    setLoadingCategoryLinking(true)

    try {
      const res = await fetch(`/api/admin/categories/${item.id}`, { cache: "no-store" })
      const data = await res.json().catch(() => null)
      const ids = Array.isArray(data?.teacher_ids) ? data.teacher_ids : []
      setLinkedCategoryTeacherIds(ids)
    } finally {
      setLoadingCategoryLinking(false)
    }
  }

  function cancelCategoryLinking() {
    setLinkingCategoryId(null)
    setLinkedCategoryTeacherIds([])
    setCategoryTeacherQuery("")
  }

  function toggleCategoryTeacher(teacherId: string) {
    setLinkedCategoryTeacherIds((prev) => {
      const current = new Set(prev)
      if (current.has(teacherId)) current.delete(teacherId)
      else current.add(teacherId)
      return Array.from(current)
    })
  }

  function selectAllCategoryTeachers() {
    setLinkedCategoryTeacherIds(teachers.map((teacher) => teacher.id))
  }

  function clearCategoryTeachers() {
    setLinkedCategoryTeacherIds([])
  }

  async function saveCategoryLinks(item: Category) {
    const selectedCount = linkedCategoryTeacherIds.length
    const ok = confirm(
      `Confirmar vinculo de ${selectedCount} professor${selectedCount === 1 ? "" : "es"} na categoria "${item.name}"?`
    )
    if (!ok) return

    setSavingCategoryLinking(true)
    const res = await fetch(`/api/admin/categories/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_ids: linkedCategoryTeacherIds }),
    })
    setSavingCategoryLinking(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao salvar vinculos de categoria")
      return
    }

    await loadAll()
    cancelCategoryLinking()
  }

  async function startYearLinking(item: TurmaYear) {
    setLinkingYear(item.student_year)
    setYearTeacherQuery("")
    setLoadingYearLinking(true)

    try {
      const res = await fetch(`/api/admin/turmas/years/${item.student_year}`, { cache: "no-store" })
      const data = await res.json().catch(() => null)
      const ids = Array.isArray(data?.teacher_ids) ? data.teacher_ids : []
      setLinkedYearTeacherIds(ids)
    } finally {
      setLoadingYearLinking(false)
    }
  }

  function cancelYearLinking() {
    setLinkingYear(null)
    setLinkedYearTeacherIds([])
    setYearTeacherQuery("")
  }

  function toggleYearTeacher(teacherId: string) {
    setLinkedYearTeacherIds((prev) => {
      const current = new Set(prev)
      if (current.has(teacherId)) current.delete(teacherId)
      else current.add(teacherId)
      return Array.from(current)
    })
  }

  function selectAllYearTeachers() {
    setLinkedYearTeacherIds(teachers.map((teacher) => teacher.id))
  }

  function clearYearTeachers() {
    setLinkedYearTeacherIds([])
  }

  async function saveYearLinks(item: TurmaYear) {
    const selectedCount = linkedYearTeacherIds.length
    const ok = confirm(
      `Confirmar vinculo de ${selectedCount} professor${selectedCount === 1 ? "" : "es"} na turma "${item.label}"?`
    )
    if (!ok) return

    setSavingYearLinking(true)
    const res = await fetch(`/api/admin/turmas/years/${item.student_year}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_ids: linkedYearTeacherIds }),
    })
    setSavingYearLinking(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao salvar vinculos da turma")
      return
    }

    await loadAll()
    cancelYearLinking()
  }

  const filteredCategories = useMemo(() => {
    const normalized = normalizeSearch(query)
    if (!normalized) return categories
    return categories.filter((item) => item.name.toLowerCase().includes(normalized))
  }, [categories, query])

  const filteredCategoryTeachers = useMemo(() => {
    const normalized = normalizeSearch(categoryTeacherQuery)
    if (!normalized) return teachers
    return teachers.filter((teacher) => {
      const hay = `${teacher.name} ${teacher.email}`.toLowerCase()
      return hay.includes(normalized)
    })
  }, [categoryTeacherQuery, teachers])

  const filteredYearTeachers = useMemo(() => {
    const normalized = normalizeSearch(yearTeacherQuery)
    if (!normalized) return teachers
    return teachers.filter((teacher) => {
      const hay = `${teacher.name} ${teacher.email}`.toLowerCase()
      return hay.includes(normalized)
    })
  }, [yearTeacherQuery, teachers])

  return (
    <div className="p-6 text-white space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Categorias e Turmas</h1>
          <p className="text-slate-300 mt-1">
            Organize visibilidade por categoria, turma (ano) e material especifico.
          </p>
        </div>
        <Button
          onClick={loadAll}
          disabled={loading}
          className="bg-white/10 hover:bg-white/15 border border-white/10"
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="bg-slate-900/20 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-300" />
            Categorias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col md:flex-row gap-3" onSubmit={createCategory}>
            <div className="flex-1">
              <Label className="text-white">Nova categoria</Label>
              <Input
                className="mt-1 bg-slate-800/60 border-slate-700 text-white"
                placeholder="Ex: Robotica"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="md:self-end">
              <Button
                type="submit"
                disabled={saving || !newName.trim()}
                className="w-full md:w-auto bg-cyan-600 hover:bg-cyan-700"
              >
                Criar categoria
              </Button>
            </div>
          </form>

          <div className="mt-4">
            <Input
              className="bg-slate-800/60 border-slate-700 text-white"
              placeholder="Buscar categoria..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="mt-4 space-y-4">
            {loading && <p className="text-slate-400">Carregando...</p>}
            {!loading && filteredCategories.length === 0 && (
              <p className="text-slate-400">Nenhuma categoria encontrada.</p>
            )}

            {!loading && filteredCategories.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCategories.map((item) => {
                  const isEditing = editingId === item.id
                  const isLinking = linkingCategoryId === item.id

                  return (
                    <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Label className="text-white text-xs">Nome da categoria</Label>
                          <Input
                            className="bg-slate-800/60 border-slate-700 text-white"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                          />
                        </div>
                      ) : (
                        <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-cyan-500/15 text-cyan-200 border border-cyan-500/30">
                          <BookOpen className="w-3.5 h-3.5" />
                          Materiais: {item.material_count ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                          <Users className="w-3.5 h-3.5" />
                          Professores: {item.teacher_count ?? 0}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              disabled={saving || !editingName.trim()}
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => saveEdit(item)}
                            >
                              Salvar
                            </Button>
                            <Button
                              type="button"
                              className="bg-white/10 hover:bg-white/15 border border-white/10"
                              onClick={cancelEdit}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => startEdit(item)}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </Button>
                        )}

                        <Button
                          type="button"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => (isLinking ? cancelCategoryLinking() : startCategoryLinking(item))}
                        >
                          <Link2 className="w-4 h-4 mr-2" />
                          {isLinking ? "Fechar vinculo" : "Vincular professores"}
                        </Button>

                        <Button
                          type="button"
                          className="bg-rose-600 hover:bg-rose-700"
                          onClick={() => deleteCategory(item)}
                          disabled={saving}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </Button>
                      </div>

                      {isLinking && (
                        <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-3">
                          {loadingCategoryLinking ? (
                            <p className="text-sm text-slate-400">Carregando professores vinculados...</p>
                          ) : (
                            <>
                              <div className="space-y-2">
                                <Label className="text-white text-xs">Professores da categoria</Label>
                                <Input
                                  className="bg-slate-800/60 border-slate-700 text-white"
                                  placeholder="Buscar professor..."
                                  value={categoryTeacherQuery}
                                  onChange={(e) => setCategoryTeacherQuery(e.target.value)}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border bg-emerald-500/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/20 transition"
                                    onClick={selectAllCategoryTeachers}
                                  >
                                    Selecionar todos
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border bg-white/5 text-white/70 border-white/10 hover:bg-white/10 transition"
                                    onClick={clearCategoryTeachers}
                                  >
                                    Limpar selecao
                                  </button>
                                </div>
                              </div>

                              <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/40">
                                {filteredCategoryTeachers.length === 0 && (
                                  <div className="p-3 text-sm text-slate-400">Nenhum professor encontrado.</div>
                                )}
                                {filteredCategoryTeachers.map((teacher) => {
                                  const checked = linkedCategoryTeacherIds.includes(teacher.id)
                                  return (
                                    <label
                                      key={teacher.id}
                                      className="flex items-start gap-2 px-3 py-2 border-b border-white/10 last:border-none cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={checked}
                                        onChange={() => toggleCategoryTeacher(teacher.id)}
                                      />
                                      <div className="min-w-0">
                                        <div className="text-sm text-white truncate">{teacher.name}</div>
                                        <div className="text-xs text-slate-400 truncate">{teacher.email}</div>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>

                              <p className="text-xs text-slate-300">Selecionados: {linkedCategoryTeacherIds.length}</p>

                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  disabled={savingCategoryLinking}
                                  className="bg-cyan-600 hover:bg-cyan-700"
                                  onClick={() => saveCategoryLinks(item)}
                                >
                                  {savingCategoryLinking ? "Salvando..." : "Salvar vinculos"}
                                </Button>

                                <Button
                                  type="button"
                                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                                  onClick={cancelCategoryLinking}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/20 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-amber-300" />
            Turmas (Ano)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300 mb-4">
            Configure quais professores pertencem a cada turma/ano. Esse vinculo controla materiais por turma.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {yearGroups.map((item) => {
              const isLinking = linkingYear === item.student_year
              return (
                <div key={item.student_year} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <h3 className="text-lg font-semibold text-white">{item.label}</h3>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-cyan-500/15 text-cyan-200 border border-cyan-500/30">
                      <BookOpen className="w-3.5 h-3.5" />
                      Materiais: {item.material_count ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                      <Users className="w-3.5 h-3.5" />
                      Professores: {item.teacher_count ?? 0}
                    </span>
                  </div>

                  <Button
                    type="button"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => (isLinking ? cancelYearLinking() : startYearLinking(item))}
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    {isLinking ? "Fechar vinculo" : "Vincular professores"}
                  </Button>

                  {isLinking && (
                    <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-3">
                      {loadingYearLinking ? (
                        <p className="text-sm text-slate-400">Carregando professores vinculados...</p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label className="text-white text-xs">Professores da turma</Label>
                            <Input
                              className="bg-slate-800/60 border-slate-700 text-white"
                              placeholder="Buscar professor..."
                              value={yearTeacherQuery}
                              onChange={(e) => setYearTeacherQuery(e.target.value)}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border bg-emerald-500/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/20 transition"
                                onClick={selectAllYearTeachers}
                              >
                                Selecionar todos
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border bg-white/5 text-white/70 border-white/10 hover:bg-white/10 transition"
                                onClick={clearYearTeachers}
                              >
                                Limpar selecao
                              </button>
                            </div>
                          </div>

                          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/40">
                            {filteredYearTeachers.length === 0 && (
                              <div className="p-3 text-sm text-slate-400">Nenhum professor encontrado.</div>
                            )}
                            {filteredYearTeachers.map((teacher) => {
                              const checked = linkedYearTeacherIds.includes(teacher.id)
                              return (
                                <label
                                  key={teacher.id}
                                  className="flex items-start gap-2 px-3 py-2 border-b border-white/10 last:border-none cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={checked}
                                    onChange={() => toggleYearTeacher(teacher.id)}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-sm text-white truncate">{teacher.name}</div>
                                    <div className="text-xs text-slate-400 truncate">{teacher.email}</div>
                                  </div>
                                </label>
                              )
                            })}
                          </div>

                          <p className="text-xs text-slate-300">Selecionados: {linkedYearTeacherIds.length}</p>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              disabled={savingYearLinking}
                              className="bg-cyan-600 hover:bg-cyan-700"
                              onClick={() => saveYearLinks(item)}
                            >
                              {savingYearLinking ? "Salvando..." : "Salvar vinculos"}
                            </Button>

                            <Button
                              type="button"
                              className="bg-white/10 hover:bg-white/15 border border-white/10"
                              onClick={cancelYearLinking}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
