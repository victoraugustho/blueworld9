"use client"

import { useEffect, useState } from "react"
import type {
  Teacher,
  TeacherContentPermissions,
  TeacherPortalPermissionKey,
  TeacherPortalPermissions,
} from "@/app/types/portal"
import {
  BookOpen,
  Bot,
  CalendarDays,
  Download,
  FileText,
  FolderKanban,
  ShieldCheck,
  X,
} from "lucide-react"
import {
  DEFAULT_CONTENT_PERMISSIONS,
  TeacherContentPermissionsEditor,
} from "./TeacherContentPermissionsEditor"

const DEFAULT_PERMISSIONS: TeacherPortalPermissions = {
  aulas: true,
  agenda_notas: true,
  materiais: true,
  projetos: true,
  ia: true,
}

const PERMISSION_OPTIONS: Array<{
  key: TeacherPortalPermissionKey
  title: string
  description: string
  icon: typeof BookOpen
}> = [
  {
    key: "aulas",
    title: "Aulas em vídeo",
    description: "Visualização das videoaulas liberadas para o professor.",
    icon: BookOpen,
  },
  {
    key: "agenda_notas",
    title: "Agenda + Notas",
    description: "Agenda, diário de aula, presença, lançamentos e notas finais.",
    icon: CalendarDays,
  },
  {
    key: "materiais",
    title: "Materiais",
    description: "Documentos e materiais definidos pelas regras de acesso.",
    icon: FileText,
  },
  {
    key: "projetos",
    title: "Projetos",
    description: "Projetos, anexos, observações e comentários autorizados.",
    icon: FolderKanban,
  },
  {
    key: "ia",
    title: "Assistente de IA",
    description: "Uso do assistente pedagógico e do histórico de conversas.",
    icon: Bot,
  },
]

export type TeacherApprovalDecision = "approve" | "reject"

export type TeacherApprovalPayload = {
  portal_permissions: TeacherPortalPermissions
  content_permissions: TeacherContentPermissions
  can_download: boolean
}

export function TeacherApprovalDialog({
  teacher,
  open,
  busy,
  error,
  onClose,
  onDecision,
}: {
  teacher: Teacher | null
  open: boolean
  busy: boolean
  error: string
  onClose: () => void
  onDecision: (decision: TeacherApprovalDecision, payload: TeacherApprovalPayload) => void
}) {
  const [permissions, setPermissions] = useState<TeacherPortalPermissions>(DEFAULT_PERMISSIONS)
  const [canDownload, setCanDownload] = useState(true)
  const [contentPermissions, setContentPermissions] = useState<TeacherContentPermissions>(
    DEFAULT_CONTENT_PERMISSIONS,
  )

  useEffect(() => {
    if (!open || !teacher) return
    setPermissions({
      ...DEFAULT_PERMISSIONS,
      ...(teacher.portal_permissions ?? {}),
    })
    setCanDownload(teacher.can_download !== false)
    setContentPermissions({
      aulas: { ...DEFAULT_CONTENT_PERMISSIONS.aulas, ...(teacher.content_permissions?.aulas ?? {}) },
      materiais: { ...DEFAULT_CONTENT_PERMISSIONS.materiais, ...(teacher.content_permissions?.materiais ?? {}) },
      projetos: { ...DEFAULT_CONTENT_PERMISSIONS.projetos, ...(teacher.content_permissions?.projetos ?? {}) },
    })
  }, [open, teacher])

  if (!open || !teacher) return null

  function setAll(value: boolean) {
    setPermissions({
      aulas: value,
      agenda_notas: value,
      materiais: value,
      projetos: value,
      ia: value,
    })
    setCanDownload(value)
  }

  function submit(decision: TeacherApprovalDecision) {
    onDecision(decision, {
      portal_permissions: permissions,
      content_permissions: contentPermissions,
      can_download: canDownload,
    })
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-approval-title"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 text-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <ShieldCheck className="h-4 w-4" />
              Análise de acesso
            </div>
            <h2 id="teacher-approval-title" className="truncate text-xl font-bold sm:text-2xl">
              {teacher.name}
            </h2>
            <p className="truncate text-sm text-slate-300">{teacher.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-emerald-100">Papel do usuário: Professor</p>
              <p className="text-xs text-emerald-100/70">
                Permissões administrativas não podem ser concedidas por este formulário.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAll(true)}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
              >
                Marcar todas
              </button>
              <button
                type="button"
                onClick={() => setAll(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PERMISSION_OPTIONS.map((option) => {
              const Icon = option.icon
              const enabled = permissions[option.key]
              return (
                <label
                  key={option.key}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                    enabled
                      ? "border-cyan-400/35 bg-cyan-400/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setPermissions((current) => ({
                      ...current,
                      [option.key]: event.target.checked,
                    }))}
                    className="mt-1 h-4 w-4 accent-cyan-500"
                  />
                  <span className="min-w-0">
                    <span className="mb-1 flex items-center gap-2 font-semibold text-white">
                      <Icon className="h-4 w-4 text-cyan-300" />
                      {option.title}
                    </span>
                    <span className="block text-xs leading-relaxed text-slate-300">
                      {option.description}
                    </span>
                  </span>
                </label>
              )
            })}

            <label
              className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition sm:col-span-2 ${
                canDownload
                  ? "border-violet-400/35 bg-violet-400/10"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <input
                type="checkbox"
                checked={canDownload}
                onChange={(event) => setCanDownload(event.target.checked)}
                className="mt-1 h-4 w-4 accent-violet-500"
              />
              <span>
                <span className="mb-1 flex items-center gap-2 font-semibold text-white">
                  <Download className="h-4 w-4 text-violet-300" />
                  Downloads e exportações
                </span>
                <span className="block text-xs leading-relaxed text-slate-300">
                  Permite baixar anexos de projetos e exportar relatórios de notas.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white">Conteúdos liberados</h3>
              <p className="mt-1 text-sm text-slate-300">
                Mantenha “Herdar regras atuais” para preservar o comportamento existente ou selecione exatamente o que este professor poderá visualizar.
              </p>
            </div>
            <TeacherContentPermissionsEditor
              value={contentPermissions}
              onChange={setContentPermissions}
              portalPermissions={permissions}
              disabled={busy}
            />
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={() => submit("reject")}
            disabled={busy}
            className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            Reprovar cadastro
          </button>
          <button
            type="button"
            onClick={() => submit("approve")}
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Salvando decisão..." : "Aprovar com estas permissões"}
          </button>
        </footer>
      </div>
    </div>
  )
}
