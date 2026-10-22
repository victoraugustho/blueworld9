"use client"

import { useRef, useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Loader2, ShieldMinus, ShieldPlus } from 'lucide-react'
import type { Teacher } from '@/app/types/portal'
import { getPortalUserRole, isAdminUser } from '@/lib/auth/authorization'
import { useConfirmDialog } from '@/components/ui/use-confirm-dialog'

type Props = {teacher:Teacher;canManageRoles:boolean;onChanged:()=>Promise<void>}

export default function TeacherRoleAction({teacher,canManageRoles,onChanged}:Props) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('')
  const sending = useRef(false)
  const {confirm,confirmDialog} = useConfirmDialog()
  const coordinator = isAdminUser(teacher)
  const available = canManageRoles && !teacher.role_management_protected
    && ['admin','teacher'].includes(getPortalUserRole(teacher))
    && (coordinator || (teacher.approved && teacher.active !== false))
  if (!available) return null
  const title = coordinator ? 'Remover coordenação' : 'Tornar coordenador'
  async function changeRole() {
    if (sending.current) return
    sending.current=true;setBusy(true)
    try {
      const accepted = await confirm({
        title,
        description:coordinator
          ? `Remover o acesso de coordenação de ${teacher.name}? A conta voltará ao papel de professor, mantendo alunos, notas, vínculos e permissões de professor. As sessões serão encerradas e será necessário entrar novamente.`
          : `Tornar ${teacher.name} coordenador? A conta terá acesso às funções administrativas gerais. Restrições específicas por ID continuam valendo. As sessões serão encerradas e será necessário entrar novamente.`,
        confirmText:title,variant:coordinator?'danger':'default',
      })
      if (!accepted) return
      const response = await fetch(`/api/admin/teachers/${teacher.id}/role`,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({role:coordinator?'teacher':'admin',expected_role:coordinator?'admin':'teacher'}),
      })
      const data = await response.json().catch(()=>null)
      if (!response.ok) throw new Error(data?.error??'Não foi possível alterar a coordenação. Atualize a lista e tente novamente.')
      await onChanged()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Falha de comunicação. Atualize a lista antes de tentar novamente.')
    } finally {sending.current=false;setBusy(false)}
  }
  const Icon = coordinator ? ShieldMinus : ShieldPlus
  return <>
    <button type="button" title={title} aria-label={title} disabled={busy} onClick={()=>void changeRole()}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50 ${coordinator?'border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20':'border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20'}`}>
      {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Icon className="h-4 w-4"/>}
    </button>
    {confirmDialog}
    <AlertDialog.Root open={!!error} onOpenChange={open=>{if(!open)setError('')}}><AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"/>
      <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[111] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-slate-950 p-5 text-white shadow-2xl">
        <AlertDialog.Title className="text-lg font-semibold text-white">Não foi possível concluir</AlertDialog.Title>
        <AlertDialog.Description className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{error}</AlertDialog.Description>
        <div className="mt-5 flex justify-end"><AlertDialog.Action className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500">Entendi</AlertDialog.Action></div>
      </AlertDialog.Content>
    </AlertDialog.Portal></AlertDialog.Root>
  </>
}
