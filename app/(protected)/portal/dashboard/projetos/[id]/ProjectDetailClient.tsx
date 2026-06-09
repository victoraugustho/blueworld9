"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, RotateCcw, Trash2, X, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

type Locale = "pt-BR" | "es"

type ProjectDetail = {
  id: string
  title: string
  summary?: string | null
  introduction?: string | null
  title_pt: string
  title_es: string
  summary_pt?: string | null
  summary_es?: string | null
  cover_image_url?: string | null
  project_type?: "arduino_mblock" | "programming" | "custom" | string
  category_title?: string | null
  category_description?: string | null
  category_cover_image_url?: string | null
  created_at?: string | null
  updated_at?: string | null
  published_at?: string | null
  gallery_images: Array<{
    id: string
    title_pt?: string | null
    title_es?: string | null
    file_url: string
  }>
  documents: Array<{
    id: string
    title_pt?: string | null
    title_es?: string | null
    file_name: string
    file_url: string
    mime_type: string
  }>
  links: Array<{
    id: string
    title: string
    url: string
    description?: string | null
  }>
  teacher_note: string
  teacher_note_updated_at?: string | null
}

type CommentRow = {
  id: string
  comment: string
  created_at: string
  can_delete?: boolean
  teacher_name?: string | null
  teacher_email?: string | null
  teacher_avatar_url?: string | null
}

function formatDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString(locale === "es" ? "es-UY" : "pt-BR")
}

function initials(name: string | null | undefined) {
  const safe = String(name ?? "").trim()
  if (!safe) return "P"
  const parts = safe.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((item) => item.charAt(0).toUpperCase()).join("")
}

export default function ProjectDetailClient({ projectId, locale }: { projectId: string; locale: Locale }) {
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [newComment, setNewComment] = useState("")
  const [savingComment, setSavingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxZoom, setLightboxZoom] = useState<number>(1)

  const labels = useMemo(() => {
    if (locale === "es") {
      return {
        back: "Volver",
        loading: "Cargando proyecto...",
        notFound: "Proyecto no encontrado o sin acceso.",
        title: "Título del proyecto",
        introduction: "Introducción",
        gallery: "Galería",
        documents: "Anexos",
        links: "Referencias",
        comments: "Comentarios de profesores",
        notes: "Mis observaciones",
        save: "Guardar",
        sendComment: "Enviar comentario",
        emptyComments: "Aún no hay comentarios.",
        commentPlaceholder: "Comparte una experiencia, sugerencia o ajuste de clase...",
        notePlaceholder: "Registra observaciones privadas sobre cómo aplicar este proyecto en tus clases.",
        category: "Categoría",
        date: "Fecha",
        noSummary: "Sin introducción disponible.",
        noGallery: "Sin imágenes en la galería.",
        noDocuments: "Sin anexos disponibles.",
        noLinks: "Sin enlaces de referencia.",
        saveCommentError: "Error al enviar comentario.",
        deleteComment: "Eliminar comentario",
        deleteCommentConfirm: "¿Deseas eliminar este comentario?",
        deleteCommentError: "Error al eliminar comentario.",
        saveNoteError: "Error al guardar observaciones.",
        view: "Visualizar",
        download: "Descargar",
        openLink: "Abrir",
        copyLink: "Copiar",
        copied: "Copiado",
        zoomIn: "Acercar",
        zoomOut: "Alejar",
        resetZoom: "Restablecer",
        close: "Cerrar",
        previous: "Anterior",
        next: "Siguiente",
      }
    }

    return {
      back: "Voltar",
      loading: "Carregando projeto...",
      notFound: "Projeto não encontrado ou sem acesso.",
      title: "Título do projeto",
      introduction: "Introdução",
      gallery: "Galeria",
      documents: "Anexos",
      links: "Referências",
      comments: "Comentários de professores",
      notes: "Minhas observações",
      save: "Salvar",
      sendComment: "Enviar comentário",
      emptyComments: "Ainda não há comentários.",
      commentPlaceholder: "Compartilhe uma experiência, sugestão ou ajuste de aula...",
      notePlaceholder: "Registre observações privadas sobre como aplicar este projeto nas suas turmas.",
      category: "Categoria",
      date: "Data",
      noSummary: "Sem introdução disponível.",
      noGallery: "Sem imagens na galeria.",
      noDocuments: "Sem anexos disponíveis.",
      noLinks: "Sem links de referência.",
      saveCommentError: "Falha ao enviar comentário.",
      deleteComment: "Excluir comentário",
      deleteCommentConfirm: "Deseja excluir este comentário?",
      deleteCommentError: "Falha ao excluir comentário.",
      saveNoteError: "Falha ao salvar observações.",
      view: "Visualizar",
      download: "Download",
      openLink: "Abrir",
      copyLink: "Copiar",
      copied: "Copiado",
      zoomIn: "Aproximar",
      zoomOut: "Afastar",
      resetZoom: "Resetar zoom",
      close: "Fechar",
      previous: "Anterior",
      next: "Próxima",
    }
  }, [locale])

  const projectCategoryLabel = useMemo(() => {
    return String(project?.category_title ?? "").trim() || (locale === "es" ? "General" : "Geral")
  }, [locale, project?.category_title])

  const projectDate = useMemo(() => {
    if (!project) return "-"
    return formatDate(project.published_at ?? project.updated_at ?? project.created_at ?? null, locale)
  }, [locale, project])

  async function loadProject() {
    setLoading(true)
    const res = await fetch(`/api/portal/projects/${projectId}?locale=${locale}`, { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (res.ok && data) {
      setProject(data)
      setNote(String(data?.teacher_note ?? ""))
    } else {
      setProject(null)
    }
    setLoading(false)
  }

  async function loadComments() {
    const res = await fetch(`/api/portal/projects/${projectId}/comments`, { cache: "no-store" })
    const data = await res.json().catch(() => [])
    setComments(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    void loadProject()
    void loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, locale])

  async function saveComment() {
    const content = newComment.trim()
    if (!content) return
    setSavingComment(true)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: content }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error ?? labels.saveCommentError)
        return
      }
      setNewComment("")
      setComments((prev) => [data, ...prev])
    } finally {
      setSavingComment(false)
    }
  }

  async function deleteComment(commentId: string) {
    if (!commentId) return
    if (!window.confirm(labels.deleteCommentConfirm)) return
    setDeletingCommentId(commentId)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: commentId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error ?? labels.deleteCommentError)
        return
      }
      setComments((prev) => prev.filter((item) => item.id !== commentId))
    } finally {
      setDeletingCommentId(null)
    }
  }

  async function saveNote() {
    setSavingNote(true)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error ?? labels.saveNoteError)
        return
      }
      setProject((prev) =>
        prev
          ? {
              ...prev,
              teacher_note: String(data?.note ?? ""),
              teacher_note_updated_at: data?.updated_at ?? null,
            }
          : prev,
      )
    } finally {
      setSavingNote(false)
    }
  }

  async function copyLink(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLinkId(id)
      setTimeout(() => setCopiedLinkId((prev) => (prev === id ? null : prev)), 1800)
    } catch {
      setCopiedLinkId(null)
    }
  }

  function clampZoom(value: number) {
    return Math.min(4, Math.max(1, value))
  }

  function openLightbox(index: number) {
    setLightboxIndex(index)
    setLightboxZoom(1)
  }

  function closeLightbox() {
    setLightboxIndex(null)
    setLightboxZoom(1)
  }

  function goToNextImage() {
    setLightboxIndex((prev) => {
      if (prev === null || !project || project.gallery_images.length === 0) return prev
      return (prev + 1) % project.gallery_images.length
    })
  }

  function goToPreviousImage() {
    setLightboxIndex((prev) => {
      if (prev === null || !project || project.gallery_images.length === 0) return prev
      return prev === 0 ? project.gallery_images.length - 1 : prev - 1
    })
  }

  useEffect(() => {
    if (lightboxIndex === null) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox()
        return
      }
      if (event.key === "ArrowRight") {
        goToNextImage()
        return
      }
      if (event.key === "ArrowLeft") {
        goToPreviousImage()
        return
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        setLightboxZoom((prev) => clampZoom(prev + 0.2))
        return
      }
      if (event.key === "-") {
        event.preventDefault()
        setLightboxZoom((prev) => clampZoom(prev - 0.2))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [lightboxIndex, project])

  if (loading) return <div className="p-6 text-white">{labels.loading}</div>

  if (!project) {
    return (
      <div className="p-6 text-white space-y-3">
        <p>{labels.notFound}</p>
        <Link href="/portal/dashboard/projetos">
          <Button className="bg-cyan-600 hover:bg-cyan-700">{labels.back}</Button>
        </Link>
      </div>
    )
  }

  const selectedGalleryImage =
    lightboxIndex !== null && lightboxIndex >= 0 && lightboxIndex < project.gallery_images.length
      ? project.gallery_images[lightboxIndex]
      : null

  const introduction = String(project.introduction ?? project.summary ?? "").trim() || labels.noSummary

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/90">BlueWorld9 Projects</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white">{project.title}</h2>
        </div>
        <Link href="/portal/dashboard/projetos">
          <Button className="bg-white/10 hover:bg-white/15 border border-white/10">{labels.back}</Button>
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur">
        <div className="h-[170px] md:h-[210px] w-full border-b border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/30 flex items-center justify-center overflow-hidden">
          {project.cover_image_url ? (
            <img
              src={project.cover_image_url}
              alt={project.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-sm text-slate-400">Sem imagem de capa</div>
          )}
        </div>
        <div className="relative p-2.5 md:p-3">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.86))]" />
          <div className="relative space-y-1.5">
            <p className="text-xs md:text-sm text-slate-100 max-w-3xl whitespace-pre-wrap">{introduction}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5">
                {labels.category}: {projectCategoryLabel}
              </span>
              <span className="rounded-full border border-cyan-300/35 bg-cyan-500/20 px-2.5 py-0.5 text-cyan-100">
                {labels.date}: {projectDate}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <Card className="bg-slate-900/30 border border-white/10 backdrop-blur">
          <CardHeader className="px-3 py-2.5">
            <CardTitle className="text-base text-white">{labels.notes}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0 space-y-2.5">
            <Textarea
              className="bg-slate-800/60 border-slate-700 text-white"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={labels.notePlaceholder}
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-slate-400">
                {project.teacher_note_updated_at ? formatDate(project.teacher_note_updated_at, locale) : "-"}
              </p>
              <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => void saveNote()} disabled={savingNote}>
                {savingNote ? "..." : labels.save}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/30 border border-white/10 backdrop-blur">
          <CardHeader className="px-3 py-2.5">
            <CardTitle className="text-base text-white">{labels.gallery}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            {project.gallery_images.length === 0 ? <p className="text-sm text-slate-400">{labels.noGallery}</p> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {project.gallery_images.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openLightbox(index)}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left"
                >
                  <img
                    src={item.file_url}
                    alt={locale === "es" ? item.title_es || "Galería" : item.title_pt || "Galeria"}
                    className="h-40 md:h-44 w-full object-contain bg-slate-950/50 transition duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="p-2 text-xs text-slate-300">
                    {locale === "es" ? item.title_es || "-" : item.title_pt || "-"}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
          <Card className="bg-slate-900/30 border border-white/10 backdrop-blur">
            <CardHeader className="px-3 py-2.5">
              <CardTitle className="text-base text-white">{labels.documents}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0 space-y-2">
              {project.documents.length === 0 ? <p className="text-sm text-slate-400">{labels.noDocuments}</p> : null}
              {project.documents.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-2">
                  <p className="text-sm text-white font-medium">
                    {locale === "es" ? item.title_es || item.file_name : item.title_pt || item.file_name}
                  </p>
                  <p className="text-xs text-cyan-300 break-all">{item.file_name}</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center rounded-md border border-cyan-300/40 bg-cyan-500/20 px-3 text-xs font-medium text-cyan-100 hover:bg-cyan-500/30"
                    >
                      {labels.view}
                    </a>
                    <a
                      href={item.file_url}
                      download={item.file_name}
                      className="inline-flex h-8 items-center rounded-md border border-white/20 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
                    >
                      {labels.download}
                    </a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/30 border border-white/10 backdrop-blur">
            <CardHeader className="px-3 py-2.5">
              <CardTitle className="text-base text-white">{labels.links}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0 space-y-2">
              {project.links.length === 0 ? <p className="text-sm text-slate-400">{labels.noLinks}</p> : null}
              {project.links.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-2">
                  <p className="text-sm text-white font-medium">{item.title}</p>
                  {item.description ? <p className="text-xs text-slate-300">{item.description}</p> : null}
                  <p className="text-xs text-cyan-300 break-all">{item.url}</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center rounded-md border border-cyan-300/40 bg-cyan-500/20 px-3 text-xs font-medium text-cyan-100 hover:bg-cyan-500/30"
                    >
                      {labels.openLink}
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyLink(item.url, item.id)}
                      className="inline-flex h-8 items-center rounded-md border border-white/20 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
                    >
                      {copiedLinkId === item.id ? labels.copied : labels.copyLink}
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/30 border border-white/10 backdrop-blur">
          <CardHeader className="px-3 py-2.5">
            <CardTitle className="text-base text-white">{labels.comments}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0 space-y-2.5">
            <div className="space-y-2">
              <Textarea
                className="bg-slate-800/60 border-slate-700 text-white"
                rows={3}
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                placeholder={labels.commentPlaceholder}
              />
              <div className="flex justify-end">
                <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => void saveComment()} disabled={savingComment}>
                  {savingComment ? "..." : labels.sendComment}
                </Button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-auto pr-1">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {comment.teacher_avatar_url ? (
                        <img
                          src={comment.teacher_avatar_url}
                          alt={comment.teacher_name || "Professor"}
                          className="w-8 h-8 rounded-full object-cover border border-white/20"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-white/20 bg-cyan-700/60 flex items-center justify-center text-xs font-semibold text-white">
                          {initials(comment.teacher_name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{comment.teacher_name || "Professor"}</p>
                        <p className="text-xs text-slate-400">{formatDate(comment.created_at, locale)}</p>
                      </div>
                    </div>
                    {comment.can_delete ? (
                      <button
                        type="button"
                        onClick={() => void deleteComment(comment.id)}
                        disabled={deletingCommentId === comment.id}
                        aria-label={labels.deleteComment}
                        title={labels.deleteComment}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-300/35 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-100 whitespace-pre-wrap">{comment.comment}</p>
                </div>
              ))}
              {comments.length === 0 ? <p className="text-sm text-slate-400">{labels.emptyComments}</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedGalleryImage ? (
        <div
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm p-3 md:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLightbox()
          }}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-200 truncate pr-3">
                {locale === "es" ? selectedGalleryImage.title_es || "-" : selectedGalleryImage.title_pt || "-"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goToPreviousImage}
                  aria-label={labels.previous}
                  title={labels.previous}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/15"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToNextImage}
                  aria-label={labels.next}
                  title={labels.next}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/15"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxZoom((prev) => clampZoom(prev - 0.2))}
                  aria-label={labels.zoomOut}
                  title={labels.zoomOut}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/15"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxZoom((prev) => clampZoom(prev + 0.2))}
                  aria-label={labels.zoomIn}
                  title={labels.zoomIn}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-cyan-300/40 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxZoom(1)}
                  aria-label={labels.resetZoom}
                  title={labels.resetZoom}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/15"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={closeLightbox}
                  aria-label={labels.close}
                  title={labels.close}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-300/35 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className="relative flex-1 overflow-auto rounded-xl border border-white/10 bg-slate-950/70"
              onWheel={(event) => {
                event.preventDefault()
                const delta = event.deltaY < 0 ? 0.12 : -0.12
                setLightboxZoom((prev) => clampZoom(prev + delta))
              }}
            >
              <img
                src={selectedGalleryImage.file_url}
                alt={locale === "es" ? selectedGalleryImage.title_es || "Galería" : selectedGalleryImage.title_pt || "Galeria"}
                className="mx-auto my-4 max-h-[78vh] w-auto max-w-full object-contain transition-transform duration-200 ease-out"
                style={{ transform: `scale(${lightboxZoom})` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
