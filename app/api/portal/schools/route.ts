import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTeacherApi } from '@/lib/auth/require'
import { getPortalUserRole } from '@/lib/auth/authorization'
import { writeSchoolAuditMirror } from '@/lib/schools/audit'
import { SchoolError } from '@/lib/schools/contracts'
import { schools, schoolsEnabled } from '@/lib/schools/server'

const query = z.object({
  view: z.enum(['schools', 'detail', 'inventory', 'requests', 'audit', 'templates', 'options']).default('schools'),
  schoolId: z.string().uuid().optional(), search: z.string().max(160).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
})
async function handle(req: NextRequest, mutation: boolean) {
  if (!schoolsEnabled()) return NextResponse.json({ error:'Módulo indisponível.', code:'DISABLED' }, { status:404 })
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const role = getPortalUserRole(auth.teacher)
  if (!['admin', 'teacher'].includes(role)) return NextResponse.json({ error:'Sem permissão.', code:'FORBIDDEN' }, { status:403 })
  const actor = { id:auth.teacherId, name:auth.teacher.name, admin:role === 'admin' }
  try {
    if (!mutation) {
      const filter = query.parse(Object.fromEntries(req.nextUrl.searchParams))
      return NextResponse.json(await schools.read(actor,filter.view,filter.schoolId,filter.search,filter.page), { headers:{ 'Cache-Control':'private, no-store' } })
    }
    const origin = req.headers.get('origin')
    if (origin && origin !== req.nextUrl.origin) throw new SchoolError(403,'ORIGIN','Origem da requisição inválida.')
    const key = z.string().uuid().parse(req.headers.get('idempotency-key'))
    const raw = await req.text()
    if (Buffer.byteLength(raw,'utf8') > 150000) throw new SchoolError(413,'TOO_LARGE','Envio muito grande.')
    const body = JSON.parse(raw)
    const result = await schools.command(actor,key,body)
    // The module's authoritative audit is committed in the same transaction above.
    await writeSchoolAuditMirror({ req, actor:{ ...actor,email:auth.teacher.email,role,sessionId:auth.sessionId }, action:`schools.${body.action}`,
      targetId:body.schoolId ?? result.id ?? key, commandKey:key })
    return NextResponse.json(result, { headers:{ 'Cache-Control':'private, no-store' } })
  } catch (error) {
    if (error instanceof SchoolError) return NextResponse.json({ error:error.message,code:error.code }, { status:error.status })
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error:'Confira os dados enviados.',code:'VALIDATION' }, { status:400 })
    const code = (error as { code?: string })?.code
    if (code === '42P01' || code === '42703') return NextResponse.json({ error:'O módulo aguarda a instalação da migração de Escolas e Inventário.',code:'MIGRATION_REQUIRED' }, { status:503 })
    if (code === '23505') return NextResponse.json({ error:'Código, patrimônio ou vínculo já cadastrado. Atualize e confira os registros.',code:'DUPLICATE' }, { status:409 })
    if (code === '23503') return NextResponse.json({ error:'Registro vinculado a outros dados. Confira os vínculos antes de continuar.',code:'LINKED' }, { status:409 })
    console.error('[schools]',error)
    return NextResponse.json({ error:'Não foi possível concluir a operação. Tente novamente.',code:'INTERNAL' }, { status:500 })
  }
}
export const GET = (req: NextRequest) => handle(req,false)
export const POST = (req: NextRequest) => handle(req,true)
