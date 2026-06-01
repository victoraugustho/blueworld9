"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FileUp, ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ProjectLocale = "pt-BR" | "es"
type ProjectStatus = "draft" | "published" | "archived"
type ProjectType = "arduino_mblock" | "programming" | "custom"

type AssetUI = {
  local_id: string
  id?: string
  asset_type: "gallery_image" | "document"
  locale: ProjectLocale
  title_pt?: string | null
  title_es?: string | null
  description_pt?: string | null
  description_es?: string | null
  file_name: string
  file_url: string
  mime_type: string
  size_bytes: number
  sort_order: number
}

type LinkUI = {
  local_id: string
  id?: string
  locale: ProjectLocale
  title_pt?: string | null
  title_es?: string | null
  url: string
  description_pt?: string | null
  description_es?: string | null
  sort_order: number
}

type TeacherOption = {
  id: string
  name: string
  email: string
  country?: string | null
}

type StudentYearOption = {
  value: number
  label: string
}

type RevisionRow = {
  id: string
  revision_number: number
  created_at: string
  created_by_name?: string | null
  created_by_email?: string | null
}

function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-BR")
}

function fileNameWithoutExtension(fileName: string | null | undefined) {
  const raw = String(fileName ?? "").trim()
  if (!raw) return ""
  const normalized = raw.replaceAll("\\", "/").split("/").pop() ?? raw
  const dotIndex = normalized.lastIndexOf(".")
  if (dotIndex <= 0) return normalized
  return normalized.slice(0, dotIndex)
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
}

const TYPE_LABEL: Record<ProjectType, string> = {
  arduino_mblock: "Arduino + MBlock",
  programming: "Programação",
  custom: "Personalizado",
}

const COVER_IMAGE_RECOMMENDATION = "Recomendado: 1600 x 900 px (16:9). Minimo: 1280 x 720 px."
const GALLERY_IMAGE_RECOMMENDATION =
  "Recomendado: 1200 x 1200 px (1:1) ou 1600 x 900 px (16:9). Minimo: 1080 px no menor lado."

export default function ProjectEditorClient({ projectId }: { projectId?: string } = {}) {
  const router = useRouter()
  const isEditMode = String(projectId ?? "").trim().length > 0
  const uploadIdPrefix = useId()
  const coverInputId = `${uploadIdPrefix}-cover-upload`
  const galleryInputId = `${uploadIdPrefix}-gallery-upload`
  const documentInputId = `${uploadIdPrefix}-document-upload`

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [revisionsLoading, setRevisionsLoading] = useState(false)
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null)

  const [savedProjectId, setSavedProjectId] = useState<string | null>(isEditMode ? String(projectId).trim() : null)
  const [projectLocale, setProjectLocale] = useState<ProjectLocale>("pt-BR")
  const [projectType, setProjectType] = useState<ProjectType>("arduino_mblock")
  const [status, setStatus] = useState<ProjectStatus>("draft")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")

  const [accessScope, setAccessScope] = useState<"all" | "targeted">("all")
  const [targetTeacherIds, setTargetTeacherIds] = useState<string[]>([])
  const [targetCountries, setTargetCountries] = useState<string[]>([])
  const [targetStudentYears, setTargetStudentYears] = useState<number[]>([])

  const [galleryImages, setGalleryImages] = useState<AssetUI[]>([])
  const [documents, setDocuments] = useState<AssetUI[]>([])
  const [links, setLinks] = useState<LinkUI[]>([])
  const [revisions, setRevisions] = useState<RevisionRow[]>([])

  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [studentYearOptions, setStudentYearOptions] = useState<StudentYearOption[]>([])
  const [uploadConfig, setUploadConfig] = useState<{ image_limit_mb: number; document_limit_mb: number } | null>(null)

  const loadRevisions = useCallback(async (targetId: string) => {
    setRevisionsLoading(true)
    try {
      const res = await fetch(`/api/admin/projects/${targetId}/revisions?page=1&page_size=30`, { cache: "no-store" })
      if (!res.ok) {
        setRevisions([])
        return
      }
      const data = await res.json().catch(() => ({}))
      setRevisions(Array.isArray(data?.items) ? data.items : [])
    } finally {
      setRevisionsLoading(false)
    }
  }, [])

  const applyLoadedProject = useCallback((project: any) => {
    setSavedProjectId(String(project?.id ?? "").trim() || null)
    setProjectType((project?.project_type as ProjectType) || "arduino_mblock")
    setStatus((project?.status as ProjectStatus) || "draft")

    const locale: ProjectLocale = project?.locale === "es" ? "es" : "pt-BR"
    setProjectLocale(locale)

    const titlePt = String(project?.title_pt ?? "").trim()
    const titleEs = String(project?.title_es ?? "").trim()
    const summaryPt = String(project?.summary_pt ?? "").trim()
    const summaryEs = String(project?.summary_es ?? "").trim()
    setTitle(locale === "es" ? titleEs || titlePt : titlePt || titleEs)
    setSummary(locale === "es" ? summaryEs || summaryPt : summaryPt || summaryEs)
    setCoverImageUrl(String(project?.cover_image_url ?? ""))

    setAccessScope(project?.access_scope === "targeted" ? "targeted" : "all")
    setTargetTeacherIds(Array.isArray(project?.target_teacher_ids) ? project.target_teacher_ids : [])
    setTargetCountries(Array.isArray(project?.target_countries) ? project.target_countries : [])
    setTargetStudentYears(
      Array.isArray(project?.target_student_years)
        ? project.target_student_years.map((item: any) => Number(item)).filter((item: number) => Number.isInteger(item))
        : [],
    )

    const mapAsset = (asset: any): AssetUI => ({
      local_id: uid(),
      id: String(asset?.id ?? "").trim() || undefined,
      asset_type: String(asset?.asset_type ?? "") === "document" ? "document" : "gallery_image",
      locale:
        asset?.locale === "es"
          ? "es"
          : !String(asset?.title_pt ?? "").trim() && String(asset?.title_es ?? "").trim()
            ? "es"
            : "pt-BR",
      title_pt: String(asset?.title_pt ?? "").trim() || null,
      title_es: String(asset?.title_es ?? "").trim() || null,
      description_pt: String(asset?.description_pt ?? "").trim() || null,
      description_es: String(asset?.description_es ?? "").trim() || null,
      file_name: String(asset?.file_name ?? ""),
      file_url: String(asset?.file_url ?? ""),
      mime_type: String(asset?.mime_type ?? ""),
      size_bytes: Number(asset?.size_bytes ?? 0),
      sort_order: Number(asset?.sort_order ?? 0),
    })

    setGalleryImages(Array.isArray(project?.gallery_images) ? project.gallery_images.map(mapAsset) : [])
    setDocuments(Array.isArray(project?.documents) ? project.documents.map(mapAsset) : [])
    setLinks(
      Array.isArray(project?.links)
        ? project.links.map((link: any, index: number) => ({
            local_id: uid(),
            id: String(link?.id ?? "").trim() || undefined,
            locale:
              String(link?.locale ?? "") === "es"
                ? "es"
                : !String(link?.title_pt ?? "").trim() && String(link?.title_es ?? "").trim()
                  ? "es"
                  : locale,
            title_pt: String(link?.title_pt ?? "").trim() || null,
            title_es: String(link?.title_es ?? "").trim() || null,
            url: String(link?.url ?? ""),
            description_pt: String(link?.description_pt ?? "").trim() || null,
            description_es: String(link?.description_es ?? "").trim() || null,
            sort_order: Number(link?.sort_order ?? index),
          }))
        : [],
    )
  }, [])

  useEffect(() => {
    let active = true

    ;(async () => {
      setLoading(true)
      try {
        const requests: Promise<Response>[] = [fetch("/api/admin/projects/options", { cache: "no-store" })]
        if (isEditMode && projectId) {
          requests.push(fetch(`/api/admin/projects/${projectId}`, { cache: "no-store" }))
        }

        const [optionsRes, projectRes] = await Promise.all(requests as any)
        const options = await optionsRes.json().catch(() => ({}))
        const loadedProject = projectRes ? await projectRes.json().catch(() => null) : null

        if (!active) return

        setTeachers(Array.isArray(options?.teachers) ? options.teachers : [])
        setStudentYearOptions(
          Array.isArray(options?.student_year_options)
            ? options.student_year_options.map((item: any) => ({
                value: Number(item?.value),
                label: String(item?.label ?? ""),
              }))
            : [],
        )
        setUploadConfig(
          options?.upload_limits
            ? {
                image_limit_mb: Number(options.upload_limits.image_limit_mb ?? 20),
                document_limit_mb: Number(options.upload_limits.document_limit_mb ?? 50),
              }
            : null,
        )

        if (isEditMode) {
          if (!projectRes?.ok || !loadedProject) {
            alert("Projeto não encontrado.")
            router.push("/portal/dashboard/admin/projetos")
            return
          }
          applyLoadedProject(loadedProject)
          if (loadedProject?.id) {
            void loadRevisions(String(loadedProject.id))
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [applyLoadedProject, isEditMode, loadRevisions, projectId, router])

  function toggleStringValue(values: string[], value: string) {
    const set = new Set(values)
    if (set.has(value)) set.delete(value)
    else set.add(value)
    return Array.from(set)
  }

  function toggleNumberValue(values: number[], value: number) {
    const set = new Set(values)
    if (set.has(value)) set.delete(value)
    else set.add(value)
    return Array.from(set).sort((a, b) => a - b)
  }

  function getAssetTitleByLocale(asset: AssetUI) {
    return asset.locale === "es" ? asset.title_es ?? "" : asset.title_pt ?? ""
  }

  function getAssetDescriptionByLocale(asset: AssetUI) {
    return asset.locale === "es" ? asset.description_es ?? "" : asset.description_pt ?? ""
  }

  function updateAssetLocalizedTitle(asset: AssetUI, value: string) {
    if (asset.locale === "es") return { ...asset, title_es: value, title_pt: null }
    return { ...asset, title_pt: value, title_es: null }
  }

  function updateAssetLocalizedDescription(asset: AssetUI, value: string) {
    if (asset.locale === "es") return { ...asset, description_es: value, description_pt: null }
    return { ...asset, description_pt: value, description_es: null }
  }

  function getLinkTitleByLocale(link: LinkUI) {
    return link.locale === "es" ? link.title_es ?? "" : link.title_pt ?? ""
  }

  function getLinkDescriptionByLocale(link: LinkUI) {
    return link.locale === "es" ? link.description_es ?? "" : link.description_pt ?? ""
  }

  function updateLinkLocalizedTitle(link: LinkUI, value: string) {
    if (link.locale === "es") return { ...link, title_es: value, title_pt: null }
    return { ...link, title_pt: value, title_es: null }
  }

  function updateLinkLocalizedDescription(link: LinkUI, value: string) {
    if (link.locale === "es") return { ...link, description_es: value, description_pt: null }
    return { ...link, description_pt: value, description_es: null }
  }

  async function uploadAsset(kind: "image" | "document", file: File | null) {
    if (!file) return null
    const form = new FormData()
    form.set("file", file)
    form.set("kind", kind)

    const res = await fetch("/api/admin/projects/assets/upload", { method: "POST", body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha no upload.")
      return null
    }
    const payload = await res.json().catch(() => null)
    if (!payload?.file_url) return null
    return payload as {
      file_name: string
      file_url: string
      mime_type: string
      size_bytes: number
    }
  }

  async function uploadCover(file: File | null) {
    if (!file) return
    setUploadingCover(true)
    try {
      const uploaded = await uploadAsset("image", file)
      if (!uploaded) return
      setCoverImageUrl(uploaded.file_url)
    } finally {
      setUploadingCover(false)
    }
  }

  async function uploadGalleryImage(files: File[] | FileList | null | undefined) {
    const selected = Array.isArray(files) ? files : files ? Array.from(files) : []
    if (selected.length === 0) return

    const locale = projectLocale
    const uploadedItems: AssetUI[] = []

    for (const file of selected) {
      const uploaded = await uploadAsset("image", file)
      if (!uploaded) continue

      const inferredTitle = fileNameWithoutExtension(uploaded.file_name)

      uploadedItems.push({
        local_id: uid(),
        asset_type: "gallery_image",
        locale,
        title_pt: locale === "pt-BR" ? inferredTitle : null,
        title_es: locale === "es" ? inferredTitle : null,
        description_pt: null,
        description_es: null,
        file_name: uploaded.file_name,
        file_url: uploaded.file_url,
        mime_type: uploaded.mime_type,
        size_bytes: Number(uploaded.size_bytes ?? 0),
        sort_order: 0,
      })
    }

    if (uploadedItems.length === 0) return

    setGalleryImages((prev) => {
      const base = prev.length
      const normalized = uploadedItems.map((item, index) => ({
        ...item,
        sort_order: base + index,
      }))
      return [...prev, ...normalized]
    })
  }

  async function uploadDocument(file: File | null) {
    if (!file) return
    const uploaded = await uploadAsset("document", file)
    if (!uploaded) return
    const locale = projectLocale
    setDocuments((prev) => [
      ...prev,
      {
        local_id: uid(),
        asset_type: "document",
        locale,
        title_pt: null,
        title_es: null,
        description_pt: null,
        description_es: null,
        file_name: uploaded.file_name,
        file_url: uploaded.file_url,
        mime_type: uploaded.mime_type,
        size_bytes: Number(uploaded.size_bytes ?? 0),
        sort_order: prev.length,
      },
    ])
  }

  function updateAsset(localId: string, updater: (asset: AssetUI) => AssetUI, kind: "gallery_image" | "document") {
    if (kind === "gallery_image") {
      setGalleryImages((prev) => prev.map((item) => (item.local_id === localId ? updater(item) : item)))
      return
    }
    setDocuments((prev) => prev.map((item) => (item.local_id === localId ? updater(item) : item)))
  }

  function removeAsset(localId: string, kind: "gallery_image" | "document") {
    if (kind === "gallery_image") {
      setGalleryImages((prev) => prev.filter((item) => item.local_id !== localId))
      return
    }
    setDocuments((prev) => prev.filter((item) => item.local_id !== localId))
  }

  function addLink() {
    setLinks((prev) => [
      ...prev,
      {
        local_id: uid(),
        locale: projectLocale,
        title_pt: null,
        title_es: null,
        url: "",
        description_pt: null,
        description_es: null,
        sort_order: prev.length,
      },
    ])
  }

  function updateLink(localId: string, patch: Partial<LinkUI>) {
    setLinks((prev) => prev.map((item) => (item.local_id === localId ? { ...item, ...patch } : item)))
  }

  function removeLink(localId: string) {
    setLinks((prev) => prev.filter((item) => item.local_id !== localId))
  }

  async function restoreRevision(revisionId: string) {
    const currentId = String(savedProjectId ?? "").trim()
    if (!currentId) return
    if (!window.confirm("Deseja restaurar esta revisão? O conteúdo atual será substituído.")) return

    setRestoringRevisionId(revisionId)
    try {
      const res = await fetch(`/api/admin/projects/${currentId}/restore-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision_id: revisionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error ?? "Falha ao restaurar revisão.")
        return
      }
      if (data?.project) applyLoadedProject(data.project)
      await loadRevisions(currentId)
      alert("Revisão restaurada com sucesso.")
    } finally {
      setRestoringRevisionId(null)
    }
  }

  async function save() {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      alert("Preencha o título do projeto.")
      return
    }

    if (
      accessScope === "targeted" &&
      targetTeacherIds.length === 0 &&
      targetCountries.length === 0 &&
      targetStudentYears.length === 0
    ) {
      alert("Selecione ao menos um destino para publicação segmentada.")
      return
    }

    const payload = {
      project_type: projectType,
      status,
      locale: projectLocale,
      title: normalizedTitle,
      summary: summary.trim() || null,
      cover_image_url: coverImageUrl.trim() || null,
      access_scope: accessScope,
      target_teacher_ids: accessScope === "targeted" ? targetTeacherIds : [],
      target_class_ids: [],
      target_countries: accessScope === "targeted" ? targetCountries : [],
      target_student_years: accessScope === "targeted" ? targetStudentYears : [],
      gallery_images: galleryImages.map((item, index) => ({
        id: item.id,
        asset_type: "gallery_image",
        locale: item.locale,
        title_pt: item.locale === "pt-BR" ? item.title_pt?.trim() || null : null,
        title_es: item.locale === "es" ? item.title_es?.trim() || null : null,
        description_pt: item.locale === "pt-BR" ? item.description_pt?.trim() || null : null,
        description_es: item.locale === "es" ? item.description_es?.trim() || null : null,
        file_name: item.file_name,
        file_url: item.file_url,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        sort_order: index,
      })),
      documents: documents.map((item, index) => ({
        id: item.id,
        asset_type: "document",
        locale: item.locale,
        title_pt: item.locale === "pt-BR" ? item.title_pt?.trim() || null : null,
        title_es: item.locale === "es" ? item.title_es?.trim() || null : null,
        description_pt: item.locale === "pt-BR" ? item.description_pt?.trim() || null : null,
        description_es: item.locale === "es" ? item.description_es?.trim() || null : null,
        file_name: item.file_name,
        file_url: item.file_url,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        sort_order: index,
      })),
      links: links.map((item, index) => ({
        id: item.id,
        locale: item.locale,
        title: getLinkTitleByLocale(item).trim(),
        description: getLinkDescriptionByLocale(item).trim() || null,
        title_pt: item.locale === "pt-BR" ? getLinkTitleByLocale(item).trim() || null : null,
        title_es: item.locale === "es" ? getLinkTitleByLocale(item).trim() || null : null,
        url: item.url.trim(),
        description_pt: item.locale === "pt-BR" ? getLinkDescriptionByLocale(item).trim() || null : null,
        description_es: item.locale === "es" ? getLinkDescriptionByLocale(item).trim() || null : null,
        sort_order: index,
      })),
    }

    setSaving(true)
    try {
      const targetId = String(savedProjectId ?? "").trim()
      const isEdit = targetId.length > 0
      const url = isEdit ? `/api/admin/projects/${targetId}` : "/api/admin/projects"
      const method = isEdit ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error ?? "Falha ao salvar projeto.")
        return
      }

      const finalId = String(data?.id ?? savedProjectId ?? "")
      if (!isEdit && finalId) {
        setSavedProjectId(finalId)
        router.replace(`/portal/dashboard/admin/projetos/${finalId}`)
      }
      if (isEdit && finalId) {
        await loadRevisions(finalId)
      }
      alert("Projeto salvo com sucesso.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-white">Carregando editor de projetos...</div>
  }

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">{isEditMode ? "Editar Projeto" : "Novo Projeto"}</h1>
          <p className="text-sm text-slate-300 mt-1">
            Cadastro simplificado: título, introdução, galeria, anexos e referências.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/portal/dashboard/admin/projetos">
            <Button className="bg-white/10 hover:bg-white/15 border border-white/10">Voltar</Button>
          </Link>
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar projeto"}
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base text-white">Informações principais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-200">Tipo</Label>
              <select
                className="h-10 rounded-md bg-slate-800/60 border border-slate-700 px-3 text-white w-full"
                value={projectType}
                onChange={(event) => setProjectType(event.target.value as ProjectType)}
              >
                {(Object.keys(TYPE_LABEL) as ProjectType[]).map((key) => (
                  <option key={key} value={key}>
                    {TYPE_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-200">Status</Label>
              <select
                className="h-10 rounded-md bg-slate-800/60 border border-slate-700 px-3 text-white w-full"
                value={status}
                onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              >
                {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-slate-200">Título</Label>
            <Input
              className="bg-slate-800/60 border-slate-700 text-white"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={projectLocale === "es" ? "Título del proyecto" : "Título do projeto"}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-slate-200">Introdução</Label>
            <Textarea
              className="bg-slate-800/60 border-slate-700 text-white min-h-[140px]"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder={projectLocale === "es" ? "Introducción del proyecto" : "Introdução do projeto"}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-200">Imagem de capa</Label>
            <p className="text-xs text-slate-400">{COVER_IMAGE_RECOMMENDATION}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={coverInputId}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingCover}
                onChange={(event) => void uploadCover(event.target.files?.[0] ?? null)}
              />
              <label
                htmlFor={coverInputId}
                className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium transition ${
                  uploadingCover
                    ? "pointer-events-none border-cyan-300/20 bg-cyan-500/10 text-cyan-100/70"
                    : "border-cyan-300/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
                }`}
              >
                <ImagePlus className="h-4 w-4" />
                {uploadingCover ? "Enviando capa..." : "Escolher imagem de capa"}
              </label>
              <span className="text-xs text-slate-400">
                Limite: {uploadConfig ? `${uploadConfig.image_limit_mb}MB` : "20MB"}
              </span>
              {uploadingCover ? <span className="text-xs text-cyan-300">Enviando...</span> : null}
            </div>
            {coverImageUrl ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <img src={coverImageUrl} alt="capa" className="w-full max-h-[320px] object-cover rounded-lg border border-white/10" />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base text-white">Publicação e segmentação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAccessScope("all")}
              className={`rounded-md border px-3 py-2 text-sm ${accessScope === "all" ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-200"}`}
            >
              Para todos
            </button>
            <button
              type="button"
              onClick={() => setAccessScope("targeted")}
              className={`rounded-md border px-3 py-2 text-sm ${accessScope === "targeted" ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-200"}`}
            >
              Segmentado
            </button>
          </div>

          {accessScope === "targeted" ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Professores</p>
                <div className="max-h-56 overflow-auto rounded-lg border border-white/10 bg-white/5 p-2 space-y-1">
                  {teachers.map((teacher) => (
                    <label key={teacher.id} className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={targetTeacherIds.includes(teacher.id)}
                        onChange={() => setTargetTeacherIds((prev) => toggleStringValue(prev, teacher.id))}
                      />
                      <span className="text-xs text-slate-200">
                        {teacher.name}
                        <span className="block text-slate-400">{teacher.email}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Países</p>
                <div className="space-y-1">
                  {["BR", "UY", "PY"].map((country) => (
                    <label key={country} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={targetCountries.includes(country)}
                        onChange={() => setTargetCountries((prev) => toggleStringValue(prev, country))}
                      />
                      <span className="text-sm text-slate-200">{country}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Anos/Turmas</p>
                <div className="max-h-56 overflow-auto rounded-lg border border-white/10 bg-white/5 p-2 space-y-1">
                  {studentYearOptions.map((item) => (
                    <label key={item.value} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={targetStudentYears.includes(item.value)}
                        onChange={() => setTargetStudentYears((prev) => toggleNumberValue(prev, item.value))}
                      />
                      <span className="text-sm text-slate-200">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base text-white">Galeria e anexos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Galeria</p>
            <p className="text-xs text-slate-400">{GALLERY_IMAGE_RECOMMENDATION}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={galleryInputId}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void uploadGalleryImage(event.target.files)
                  event.currentTarget.value = ""
                }}
              />
              <label
                htmlFor={galleryInputId}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-cyan-300/40 bg-cyan-500/15 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25"
              >
                <ImagePlus className="h-4 w-4" />
                Enviar imagem para galeria
              </label>
              <span className="text-xs text-slate-400">
                Limite: {uploadConfig ? `${uploadConfig.image_limit_mb}MB` : "20MB"}
              </span>
              <span className="text-xs text-slate-500">Selecao multipla habilitada</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {galleryImages.map((asset) => (
                <div key={asset.local_id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                      {asset.locale === "es" ? "ES" : "PT-BR"}
                    </span>
                    <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => removeAsset(asset.local_id, "gallery_image")}>
                      Excluir
                    </Button>
                  </div>
                  <img src={asset.file_url} alt={getAssetTitleByLocale(asset) || "galeria"} className="w-full max-h-44 object-cover rounded border border-white/10" />
                  <Input
                    className="bg-slate-800/60 border-slate-700 text-white"
                    placeholder={asset.locale === "es" ? "Título (Español)" : "Título (Português)"}
                    value={getAssetTitleByLocale(asset)}
                    onChange={(event) =>
                      updateAsset(asset.local_id, (item) => updateAssetLocalizedTitle(item, event.target.value), "gallery_image")
                    }
                  />
                  <Input
                    className="bg-slate-800/60 border-slate-700 text-white"
                    placeholder={asset.locale === "es" ? "Descripción (Español) (opcional)" : "Descrição (Português) (opcional)"}
                    value={getAssetDescriptionByLocale(asset)}
                    onChange={(event) =>
                      updateAsset(asset.local_id, (item) => updateAssetLocalizedDescription(item, event.target.value), "gallery_image")
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Anexos</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={documentInputId}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv"
                className="sr-only"
                onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)}
              />
              <label
                htmlFor={documentInputId}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-500/15 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/25"
              >
                <FileUp className="h-4 w-4" />
                Enviar ficheiro
              </label>
              <span className="text-xs text-slate-400">
                Limite: {uploadConfig ? `${uploadConfig.document_limit_mb}MB` : "50MB"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((asset) => (
                <div key={asset.local_id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                      {asset.locale === "es" ? "ES" : "PT-BR"}
                    </span>
                    <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => removeAsset(asset.local_id, "document")}>
                      Excluir
                    </Button>
                  </div>
                  <a href={asset.file_url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 text-sm underline break-all">
                    {asset.file_name}
                  </a>
                  <Input
                    className="bg-slate-800/60 border-slate-700 text-white"
                    placeholder={asset.locale === "es" ? "Título (Español)" : "Título (Português)"}
                    value={getAssetTitleByLocale(asset)}
                    onChange={(event) =>
                      updateAsset(asset.local_id, (item) => updateAssetLocalizedTitle(item, event.target.value), "document")
                    }
                  />
                  <Input
                    className="bg-slate-800/60 border-slate-700 text-white"
                    placeholder={asset.locale === "es" ? "Descripción (Español) (opcional)" : "Descrição (Português) (opcional)"}
                    value={getAssetDescriptionByLocale(asset)}
                    onChange={(event) =>
                      updateAsset(asset.local_id, (item) => updateAssetLocalizedDescription(item, event.target.value), "document")
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base text-white">Links de referência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={addLink}>+ Novo link</Button>
          </div>
          <div className="space-y-3">
            {links.map((link, index) => (
              <div key={link.local_id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white font-semibold">Link {index + 1}</p>
                  <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => removeLink(link.local_id)}>
                    Excluir
                  </Button>
                </div>
                <Input
                  className="bg-slate-800/60 border-slate-700 text-white"
                  placeholder={link.locale === "es" ? "Título (Español)" : "Título (Português)"}
                  value={getLinkTitleByLocale(link)}
                  onChange={(event) => updateLink(link.local_id, updateLinkLocalizedTitle(link, event.target.value))}
                />
                <Input
                  className="bg-slate-800/60 border-slate-700 text-white"
                  placeholder="https://..."
                  value={link.url}
                  onChange={(event) => updateLink(link.local_id, { url: event.target.value })}
                />
                <Input
                  className="bg-slate-800/60 border-slate-700 text-white"
                  placeholder={link.locale === "es" ? "Descripción (Español)" : "Descrição (Português)"}
                  value={getLinkDescriptionByLocale(link)}
                  onChange={(event) => updateLink(link.local_id, updateLinkLocalizedDescription(link, event.target.value))}
                />
              </div>
            ))}
            {links.length === 0 ? <p className="text-sm text-slate-400">Nenhum link adicionado.</p> : null}
          </div>
        </CardContent>
      </Card>

      {isEditMode ? (
        <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base text-white">Revisões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!savedProjectId ? (
              <p className="text-sm text-slate-300">Salve o projeto para habilitar revisões.</p>
            ) : revisionsLoading ? (
              <p className="text-sm text-slate-300">Carregando revisões...</p>
            ) : revisions.length === 0 ? (
              <p className="text-sm text-slate-300">Nenhuma revisão disponível.</p>
            ) : (
              revisions.map((revision) => (
                <div key={revision.id} className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-white">Revisão #{revision.revision_number}</p>
                    <p className="text-xs text-slate-300">
                      {formatDate(revision.created_at)} por {revision.created_by_name || revision.created_by_email || "Usuário"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-700"
                    onClick={() => void restoreRevision(revision.id)}
                    disabled={restoringRevisionId === revision.id}
                  >
                    {restoringRevisionId === revision.id ? "Restaurando..." : "Restaurar"}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
