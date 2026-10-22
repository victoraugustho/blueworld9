import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/require'
import { getPortalUserRole, isAdminUser } from '@/lib/auth/authorization'
import { isConfiguredSuperAdminId, isSuperAdmin } from '@/lib/auth/super-admin'

type Ctx = { params: Promise<{ id: string }> }
const change = z.object({role:z.enum(['admin','teacher']),expected_role:z.enum(['admin','teacher'])}).strict()
class RoleChangeError extends Error {
  constructor(public status:number, public code:string, message:string) { super(message) }
}

export async function PATCH(req:NextRequest, context:Ctx) {
  try {
    const auth = await requireAdminApi()
    if (!auth.ok) return auth.response
    if (!isSuperAdmin({...auth.teacher,id:auth.teacherId}))
      throw new RoleChangeError(403,'SUPER_ADMIN_REQUIRED','Apenas o SuperAdmin configurado no servidor pode alterar a coordenação.')
    const origin = req.headers.get('origin')
    if (origin && origin !== req.nextUrl.origin)
      throw new RoleChangeError(403,'ORIGIN','Origem da requisição inválida.')
    const {id} = await context.params
    if (!z.string().uuid().safeParse(id).success)
      throw new RoleChangeError(400,'INVALID_ID','ID inválido.')
    if (id.toLowerCase() === auth.teacherId.toLowerCase() || isConfiguredSuperAdminId(id))
      throw new RoleChangeError(409,'PROTECTED_ACCOUNT','O papel de uma conta protegida pelo .env não pode ser alterado por esta opção.')
    const raw = await req.text()
    if (Buffer.byteLength(raw,'utf8') > 4096)
      throw new RoleChangeError(413,'TOO_LARGE','Envio muito grande.')
    const parsed = change.safeParse(JSON.parse(raw))
    if (!parsed.success)
      throw new RoleChangeError(400,'VALIDATION','Informe o papel atual e o novo papel: professor ou coordenador.')
    const input = parsed.data
    const result = await db.begin(async transaction => {
      const sql = transaction as unknown as typeof db
      const [actor] = await sql`SELECT id,name,email,role,is_admin,approved,active FROM public.teachers WHERE id=${auth.teacherId} FOR UPDATE`
      if (!actor || !actor.approved || !actor.active || !isSuperAdmin(actor))
        throw new RoleChangeError(403,'SUPER_ADMIN_REQUIRED','Sua autorização foi alterada. Atualize a página.')
      const [session] = await sql`SELECT id FROM public.teacher_sessions WHERE id=${auth.sessionId}
        AND teacher_id=${auth.teacherId} AND revoked_at IS NULL AND expires_at>NOW() FOR SHARE`
      if (!session) throw new RoleChangeError(401,'SESSION_EXPIRED','Sua sessão expirou. Entre novamente.')
      const [target] = await sql`SELECT id,name,role,is_admin,approved,active FROM public.teachers WHERE id=${id} FOR UPDATE`
      if (!target) throw new RoleChangeError(404,'NOT_FOUND','Usuário não encontrado.')
      if (!['teacher','admin'].includes(getPortalUserRole(target)))
        throw new RoleChangeError(409,'UNSUPPORTED_ROLE','Este usuário possui outro nível de acesso e não pode ser alterado por esta opção.')
      const currentRole = isAdminUser(target) ? 'admin' : 'teacher'
      if (currentRole !== input.expected_role)
        throw new RoleChangeError(409,'ROLE_CONFLICT','O papel deste usuário já foi alterado. Atualize a lista antes de continuar.')
      if (currentRole === input.role)
        return {id:target.id,name:target.name,role:currentRole,is_admin:currentRole==='admin',changed:false}
      if (input.role === 'admin' && (!target.approved || !target.active))
        throw new RoleChangeError(409,'APPROVAL_REQUIRED','Aprove e ative o cadastro antes de torná-lo coordenador.')
      const [updated] = await sql`UPDATE public.teachers SET role=${input.role},is_admin=${input.role==='admin'},updated_at=NOW()
        WHERE id=${id} RETURNING id,name,role,is_admin,updated_at`
      const sessions = await sql`UPDATE public.teacher_sessions SET revoked_at=NOW() WHERE teacher_id=${id} AND revoked_at IS NULL RETURNING id`
      // Privilege change, session revocation and audit must commit together, without runtime DDL.
      await sql`INSERT INTO public.audit_logs(id,actor_id,actor_email,actor_role,session_id,action,target_type,target_id,
        request_method,request_path,status,metadata) VALUES(${randomUUID()},${actor.id},${actor.email},'admin',${auth.sessionId},
        'admin.teachers.role.change','teacher',${id},${req.method},${req.nextUrl.pathname},'success',
        ${sql.json({before:{role:target.role,is_admin:target.is_admin},after:{role:updated.role,is_admin:updated.is_admin},revoked_sessions:sessions.length})})`
      return {...updated,changed:true}
    })
    return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}})
  } catch (error) {
    if (error instanceof RoleChangeError)
      return NextResponse.json({error:error.message,code:error.code},{status:error.status})
    if (error instanceof SyntaxError)
      return NextResponse.json({error:'Dados inválidos.',code:'VALIDATION'},{status:400})
    const failure = error as {code?:string;constraint_name?:string;message?:string}
    console.error('[admin.teachers.role]',{code:failure?.code,constraint:failure?.constraint_name,message:failure?.message})
    return NextResponse.json({error:'Não foi possível alterar a coordenação. Nenhuma alteração foi confirmada.',code:'ROLE_CHANGE_FAILED'},{status:500})
  }
}
