"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserRound, Lock, Image as ImageIcon, UploadCloud } from "lucide-react"

type Locale = "pt-BR" | "es"

export function ProfileForms({
  locale,
  teacher,
}: {
  locale: Locale
  teacher: {
    id: string
    name: string
    phone: string
    avatar_url?: string
    email: string
    country: string
    document_type: string
    document_number: string
  }
}) {
  const t = useMemo(() => {
    const isES = locale === "es"
    return {
      title: isES ? "Perfil" : "Perfil",
      subtitle: isES
        ? "Actualiza tu nombre, teléfono y foto. Email y documento están bloqueados."
        : "Atualize seu nome, telefone e foto. E-mail e documento ficam bloqueados.",
      lockedHint: isES
        ? "Para cambiar estos datos habla con un coordinador."
        : "Para alterar esses dados fale com um coordenador.",

      cardLocked: isES ? "Datos bloqueados" : "Dados bloqueados",
      email: isES ? "Email" : "E-mail",
      doc: isES ? "Documento" : "Documento",
      docType: isES ? "Tipo de documento" : "Tipo de documento",
      country: isES ? "País" : "País",

      cardData: isES ? "Datos del perfil" : "Dados do perfil",
      name: isES ? "Nombre" : "Nome",
      phone: isES ? "Teléfono" : "Telefone",
      save: isES ? "Guardar cambios" : "Salvar alterações",
      saving: isES ? "Guardando..." : "Salvando...",
      successData: isES ? "Perfil actualizado." : "Perfil atualizado.",
      errData: isES ? "Error al actualizar perfil." : "Erro ao atualizar perfil.",

      cardAvatar: isES ? "Foto de perfil" : "Foto de perfil",
      upload: isES ? "Subir foto" : "Enviar foto",
      uploading: isES ? "Subiendo..." : "Enviando...",
      remove: isES ? "Quitar foto" : "Remover foto",
      avatarHelp: isES
        ? "Formatos: JPG/PNG/WebP. Máx: 2MB."
        : "Formatos: JPG/PNG/WebP. Máx: 2MB.",
      avatarOk: isES ? "Foto actualizada." : "Foto atualizada.",
      avatarErr: isES ? "Error al subir la foto." : "Erro ao enviar a foto.",

      cardPass: isES ? "Cambiar contraseña" : "Trocar senha",
      currentPass: isES ? "Contraseña actual" : "Senha atual",
      newPass: isES ? "Nueva contraseña" : "Nova senha",
      confirmPass: isES ? "Confirmar nueva contraseña" : "Confirmar nova senha",
      change: isES ? "Cambiar contraseña" : "Trocar senha",
      changing: isES ? "Cambiando..." : "Trocando...",
      successPass: isES ? "Contraseña cambiada." : "Senha alterada.",
      errPass: isES ? "Error al cambiar contraseña." : "Erro ao trocar senha.",
      passMismatch: isES ? "Las contraseñas no coinciden." : "As senhas não conferem.",
      passMin: isES ? "Mínimo 6 caracteres." : "Mínimo 6 caracteres.",
    }
  }, [locale])

  // Perfil
  const [name, setName] = useState(teacher.name)
  const [phone, setPhone] = useState(teacher.phone)
  const [saving, setSaving] = useState(false)
  const [msgData, setMsgData] = useState<string | null>(null)

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(teacher.avatar_url ?? "")
  const [uploading, setUploading] = useState(false)
  const [msgAvatar, setMsgAvatar] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Senha
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changing, setChanging] = useState(false)
  const [msgPass, setMsgPass] = useState<string | null>(null)

  async function saveProfile() {
    setSaving(true)
    setMsgData(null)
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      })
      if (!res.ok) throw new Error("not_ok")
      setMsgData(t.successData)
    } catch {
      setMsgData(t.errData)
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(file: File) {
    setUploading(true)
    setMsgAvatar(null)

    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/portal/profile/avatar", {
        method: "POST",
        body: fd,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data?.error ?? "not_ok"))

      setAvatarUrl(String(data?.avatar_url ?? ""))
      setMsgAvatar(t.avatarOk)
    } catch {
      setMsgAvatar(t.avatarErr)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function removeAvatar() {
    setUploading(true)
    setMsgAvatar(null)
    try {
      const res = await fetch("/api/portal/profile/avatar", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data?.error ?? "not_ok"))
      setAvatarUrl("")
      setMsgAvatar(t.avatarOk)
    } catch {
      setMsgAvatar(t.avatarErr)
    } finally {
      setUploading(false)
    }
  }

  async function changePassword() {
    setMsgPass(null)

    if (newPassword.length < 6) return setMsgPass(t.passMin)
    if (newPassword !== confirmPassword) return setMsgPass(t.passMismatch)

    setChanging(true)
    try {
      const res = await fetch("/api/portal/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data?.error ?? "not_ok"))

      setMsgPass(t.successPass)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setMsgPass(t.errPass)
    } finally {
      setChanging(false)
    }
  }

  const lockedTitle = t.lockedHint

  function maskDoc(doc: string) {
    const digits = (doc ?? "").replace(/\D/g, "")
    if (digits.length <= 4) return doc
    return `${digits.slice(0, 2)}***${digits.slice(-2)}`
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <UserRound className="w-5 h-5 text-cyan-300" />
          <h1 className="text-white font-semibold text-xl">{t.title}</h1>
        </div>
        <p className="text-slate-300 text-sm">{t.subtitle}</p>
      </div>

      {/* DADOS BLOQUEADOS */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-yellow-300" />
          <h2 className="text-white font-semibold">{t.cardLocked}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-300">{t.email}</label>
            <Input
              value={teacher.email}
              disabled
              title={lockedTitle}
              className="mt-1 bg-white/5 border-white/10 text-white/80 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">{t.lockedHint}</p>
          </div>

          <div>
            <label className="text-sm text-slate-300">{t.country}</label>
            <Input
              value={teacher.country}
              disabled
              title={lockedTitle}
              className="mt-1 bg-white/5 border-white/10 text-white/80 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">{t.docType}</label>
            <Input
              value={teacher.document_type}
              disabled
              title={lockedTitle}
              className="mt-1 bg-white/5 border-white/10 text-white/80 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">{t.doc}</label>
            <Input
              value={maskDoc(teacher.document_number)}
              disabled
              title={lockedTitle}
              className="mt-1 bg-white/5 border-white/10 text-white/80 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* FOTO DE PERFIL (UPLOAD REAL) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-cyan-300" />
          <h2 className="text-white font-semibold">{t.cardAvatar}</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl border border-white/10 bg-slate-900/30 overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <UserRound className="w-7 h-7 text-white/40" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadAvatar(f)
              }}
            />

            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
              >
                <UploadCloud className="w-4 h-4 mr-2" />
                {uploading ? t.uploading : t.upload}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={removeAvatar}
                disabled={uploading || !avatarUrl}
                className="bg-transparent border-white/20 text-white"
              >
                {t.remove}
              </Button>
            </div>

            <p className="text-xs text-slate-400">{t.avatarHelp}</p>
          </div>
        </div>

        {msgAvatar && (
          <div className="mt-4 text-sm text-white/90 border border-white/10 bg-slate-900/20 rounded-xl px-4 py-3">
            {msgAvatar}
          </div>
        )}
      </div>

      {/* DADOS EDITÁVEIS */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserRound className="w-5 h-5 text-cyan-300" />
          <h2 className="text-white font-semibold">{t.cardData}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-300">{t.name}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 bg-white/10 border-white/20 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">{t.phone}</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 bg-white/10 border-white/20 text-white"
            />
          </div>
        </div>

        {msgData && (
          <div className="mt-4 text-sm text-white/90 border border-white/10 bg-slate-900/20 rounded-xl px-4 py-3">
            {msgData}
          </div>
        )}

        <div className="mt-4">
          <Button
            onClick={saveProfile}
            disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
          >
            {saving ? t.saving : t.save}
          </Button>
        </div>
      </div>

      {/* SENHA */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-purple-300" />
          <h2 className="text-white font-semibold">{t.cardPass}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-slate-300">{t.currentPass}</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 bg-white/10 border-white/20 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">{t.newPass}</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 bg-white/10 border-white/20 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">{t.confirmPass}</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 bg-white/10 border-white/20 text-white"
            />
          </div>
        </div>

        {msgPass && (
          <div className="mt-4 text-sm text-white/90 border border-white/10 bg-slate-900/20 rounded-xl px-4 py-3">
            {msgPass}
          </div>
        )}

        <div className="mt-4">
          <Button
            onClick={changePassword}
            disabled={changing || !currentPassword || !newPassword || !confirmPassword}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:opacity-90"
          >
            {changing ? t.changing : t.change}
          </Button>
        </div>
      </div>
    </div>
  )
}
