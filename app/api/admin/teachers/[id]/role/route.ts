import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/require'
import { getPortalUserRole, isAdminUser } from '@/lib/auth/authorization'
import { isConfiguredSuperAdminId, isSuperAdmin } from '@/lib/auth/super-admin'
import { getRequestOriginPolicy } from '@/lib/auth/request-origin'

type Ctx = { params: Promise<{ id: string }> }
const change = z.object({role:z.enum(['admin','teacher']),expected_role:z.enum(['admin','teacher'])}).strict()
class RoleChangeError extends Error {
  constructor(public status:number, public code:string, message:string) { super(message) }
}

export async function PATCH(req:NextRequest, context:Ctx) {
  const requestId = randomUUID()
  const originPolicy = getRequestOriginPolicy(req)
  let actor: {id:string;email:string;role:string;sessionId:string} | null = null
  let targetId: string | null = null
  const headers = {'Cache-Control':'private, no-store','X-Request-ID':requestId}
  async function recordFailure(status:number, code:string, databaseCode?:string) {
    const metadata = {
      request_id:requestId,reason_code:code,http_status:status,
      request_origin:originPolicy.requestOrigin,server_origin:originPolicy.serverOrigin,
      expected_origin:originPolicy.expectedOrigin,origin_source:originPolicy.source,
      origin_present:originPolicy.originPresent,
    }
    const diagnostic = {...metadata,actor_id:actor?.id ?? null,target_id:targetId}
    if (status >= 500) console.error('[admin.teachers.role.failed]',{...diagnostic,database_code:databaseCode})
    else console.warn('[admin.teachers.role.denied]',diagnostic)
    // A rejected attempt is recorded after rollback, without DDL or audit-log purges.
    // Anonymous/failed authentication is logged only on the server, avoiding unauthenticated database writes.
    if (!actor) return
    try {
      await db`INSERT INTO public.audit_logs(id,actor_id,actor_email,actor_role,session_id,action,target_type,target_id,
        request_method,request_path,status,metadata) VALUES(${randomUUID()},${actor.id},${actor.email},${actor.role},${actor.sessionId},
        'admin.teachers.role.change','teacher',${targetId},${req.method},${req.nextUrl.pathname},'failed',${db.json(metadata)})`
    } catch (failure) {
      console.error('[admin.teachers.role.audit.failed]',{
        request_id:requestId,reason_code:code,database_code:(failure as {code?:string})?.code,
      })
    }
  }
  try {
    const auth = await requireAdminApi()
    if (!auth.ok) {
      await recordFailure(auth.response.status,auth.response.status === 401 ? 'UNAUTHENTICATED' : 'ADMIN_REQUIRED')
      for (const [key,value] of Object.entries(headers)) auth.response.headers.set(key,value)
      return auth.response
    }
    actor = {id:auth.teacherId,email:auth.teacher.email,role:getPortalUserRole(auth.teacher),sessionId:auth.sessionId}
    const {id} = await context.params
    targetId = z.string().uuid().safeParse(id).success ? id : null
    if (!isSuperAdmin({...auth.teacher,id:auth.teacherId}))
      throw new RoleChangeError(403,'SUPER_ADMIN_REQUIRED','Apenas o SuperAdmin configurado no servidor pode alterar a coordenação.')
    if (!originPolicy.configurationValid)
      throw new RoleChangeError(403,'ORIGIN_CONFIG_INVALID','A URL pública do portal está configurada incorretamente no servidor. Verifique NEXT_PUBLIC_SITE_URL.')
    if (!originPolicy.valid)
      throw new RoleChangeError(403,'ORIGIN','Origem da requisição inválida.')
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
        ${sql.json({request_id:requestId,before:{role:target.role,is_admin:target.is_admin},after:{role:updated.role,is_admin:updated.is_admin},revoked_sessions:sessions.length})})`
      return {...updated,changed:true}
    })
    return NextResponse.json(result,{headers})
  } catch (error) {
    const status = error instanceof RoleChangeError ? error.status : error instanceof SyntaxError ? 400 : 500
    const code = error instanceof RoleChangeError ? error.code : error instanceof SyntaxError ? 'VALIDATION' : 'ROLE_CHANGE_FAILED'
    const message = error instanceof RoleChangeError ? error.message : error instanceof SyntaxError ? 'Dados inválidos.'
      : 'Não foi possível alterar a coordenação. Nenhuma alteração foi confirmada.'
    await recordFailure(status,code,(error as {code?:string})?.code)
    return NextResponse.json({error:message,code,request_id:requestId},{status,headers})
  }
}
