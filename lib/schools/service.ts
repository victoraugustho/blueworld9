import { createHash, randomUUID } from 'node:crypto'
import { assertVersion, commandSchema, reviewStatus, SchoolError, type Actor, type ItemInput } from './contracts'

type Row = Record<string, any>
export interface SchoolConnection { query(sql: string, values?: any[]): Promise<Row[]> }
export interface SchoolDatabase extends SchoolConnection {
  transaction<T>(work: (connection: SchoolConnection) => Promise<T>): Promise<T>
}
const fail = (status: number, code: string, message: string): never => { throw new SchoolError(status, code, message) }
const adminOnly = (actor: Actor) => { if (!actor.admin) fail(403, 'FORBIDDEN', 'Apenas administradores podem realizar esta ação.') }
const one = async (connection: SchoolConnection, sql: string, values: any[] = []) => (await connection.query(sql, values))[0]

async function schoolAccess(c: SchoolConnection, actor: Actor, id: string, write = false) {
  const school = await one(c, `SELECT * FROM public.bw_schools WHERE id=$1 ${write ? 'FOR UPDATE' : 'FOR SHARE'}`, [id])
  if (!school) fail(404, 'NOT_FOUND', 'Escola não encontrada.')
  if (!actor.admin) {
    const member = await one(c, 'SELECT 1 FROM public.bw_school_teachers WHERE school_id=$1 AND teacher_id=$2', [id, actor.id])
    if (!member || !school.active) fail(403, 'FORBIDDEN', 'Você não está vinculado a esta escola ativa.')
  }
  return school
}

async function audit(c: SchoolConnection, actor: Actor, schoolId: string | null, action: string, entityId: string, before: unknown, after: unknown) {
  await c.query(`INSERT INTO public.bw_school_audit
    (id,school_id,actor_id,actor_name,action,entity_id,before_data,after_data)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
  [randomUUID(), schoolId, actor.id, actor.name, action, entityId, JSON.stringify(before ?? null), JSON.stringify(after ?? null)])
}

async function insertItem(c: SchoolConnection, schoolId: string, data: ItemInput, requestId: string | null = null) {
  return one(c, `INSERT INTO public.bw_inventory_items
    (id,school_id,name,category,quantity,unit,asset_tag,serial_number,location,condition,notes,request_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
  [randomUUID(), schoolId, data.name, data.category, data.quantity, data.unit, data.asset_tag || null,
    data.serial_number, data.location, data.condition, data.notes, requestId])
}

export function schoolService(db: SchoolDatabase) {
  return {
    async read(actor: Actor, view: string, schoolId?: string, search = '', page = 1) {
      const offset = (page - 1) * 50
      return db.transaction(async c => {
        if (view === 'schools') {
          const scope = `($1::boolean OR (s.active AND EXISTS (SELECT 1 FROM public.bw_school_teachers st WHERE st.school_id=s.id AND st.teacher_id=$2)))
            AND (s.name ILIKE $3 OR s.code ILIKE $3)`
          const values = [actor.admin, actor.id, `%${search}%`]
          const rows = await c.query(`SELECT s.*,
            (SELECT COUNT(*)::int FROM public.bw_school_teachers st WHERE st.school_id=s.id) AS teacher_count,
            (SELECT COUNT(*)::int FROM public.bw_school_classes sc WHERE sc.school_id=s.id) AS class_count,
            CASE WHEN $1::boolean OR s.inventory_status='published' THEN
              (SELECT COUNT(*)::int FROM public.bw_inventory_items i WHERE i.school_id=s.id AND i.active) ELSE 0 END AS item_count
            FROM public.bw_schools s WHERE ${scope} ORDER BY s.active DESC, s.name, s.id LIMIT 50 OFFSET $4`, [...values, offset])
          const count = await one(c, `SELECT COUNT(*)::int AS total FROM public.bw_schools s WHERE ${scope}`, values)
          return { rows, total: count.total }
        }
        if (view === 'templates') {
          adminOnly(actor)
          return { rows: await c.query(`SELECT * FROM public.bw_inventory_templates WHERE name ILIKE $1 ORDER BY active DESC,name,id LIMIT 50 OFFSET $2`, [`%${search}%`, offset]),
            total: (await one(c, 'SELECT COUNT(*)::int AS total FROM public.bw_inventory_templates WHERE name ILIKE $1', [`%${search}%`])).total }
        }
        if (view === 'audit' && !schoolId) {
          adminOnly(actor)
          return { rows: await c.query('SELECT * FROM public.bw_school_audit ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1', [offset]),
            total: (await one(c, 'SELECT COUNT(*)::int AS total FROM public.bw_school_audit')).total }
        }
        if (!schoolId) fail(400, 'INVALID', 'Selecione uma escola.')
        const school = await schoolAccess(c, actor, schoolId!)
        if (view === 'options') {
          adminOnly(actor)
          return {
            teachers: await c.query('SELECT id,name,email,active,approved FROM public.teachers ORDER BY name,id'),
            classes: await c.query(`SELECT tc.id,tc.name,tc.school_year,tc.teacher_id,t.name AS teacher_name, sc.school_id,
              COALESCE((SELECT string_agg(CONCAT(ts.weekday, ': ', ts.start_time, ' - ', ts.end_time), ', ' ORDER BY ts.weekday,ts.start_time)
                FROM public.teacher_schedules ts WHERE ts.class_id=tc.id), '') AS schedules
              FROM public.teacher_classes tc JOIN public.teachers t ON t.id=tc.teacher_id
              LEFT JOIN public.bw_school_classes sc ON sc.class_id=tc.id
              WHERE sc.school_id IS NULL OR sc.school_id=$1 ORDER BY tc.school_year DESC,t.name,tc.name,tc.id`, [schoolId]),
          }
        }
        if (view === 'audit') {
          adminOnly(actor)
          return { rows: await c.query('SELECT * FROM public.bw_school_audit WHERE school_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $2', [schoolId, offset]),
            total: (await one(c, 'SELECT COUNT(*)::int AS total FROM public.bw_school_audit WHERE school_id=$1', [schoolId])).total }
        }
        if (view === 'detail') {
          return { school,
            teachers: await c.query(`SELECT t.id,t.name,t.active FROM public.bw_school_teachers st JOIN public.teachers t ON t.id=st.teacher_id WHERE st.school_id=$1 ORDER BY t.name,t.id`, [schoolId]),
            classes: await c.query(`SELECT tc.id,tc.name,tc.school_year,tc.teacher_id,t.name AS teacher_name FROM public.bw_school_classes sc
              JOIN public.teacher_classes tc ON tc.id=sc.class_id JOIN public.teachers t ON t.id=tc.teacher_id WHERE sc.school_id=$1 ORDER BY tc.school_year DESC,tc.name,tc.id`, [schoolId]),
          }
        }
        if (view === 'requests') {
          const scope = 'r.school_id=$1 AND ($2::boolean OR r.requester_id=$3)'
          return { rows: await c.query(`SELECT r.*,COALESCE(t.name,r.requester_name) AS requester_name FROM public.bw_inventory_requests r LEFT JOIN public.teachers t ON t.id=r.requester_id
              WHERE ${scope} ORDER BY (r.status='pending') DESC,r.created_at DESC,r.id LIMIT 50 OFFSET $4`, [schoolId, actor.admin, actor.id, offset]),
            total: (await one(c, `SELECT COUNT(*)::int AS total FROM public.bw_inventory_requests r WHERE ${scope}`, [schoolId, actor.admin, actor.id])).total }
        }
        if (view === 'inventory') {
          if (!actor.admin && school.inventory_status !== 'published') return { rows: [], total: 0, draft: true }
          const scope = 'school_id=$1 AND active AND (name ILIKE $2 OR COALESCE(asset_tag,\'\') ILIKE $2 OR location ILIKE $2)'
          return { rows: await c.query(`SELECT * FROM public.bw_inventory_items WHERE ${scope} ORDER BY name,id LIMIT 50 OFFSET $3`, [schoolId, `%${search}%`, offset]),
            total: (await one(c, `SELECT COUNT(*)::int AS total FROM public.bw_inventory_items WHERE ${scope}`, [schoolId, `%${search}%`])).total }
        }
        return fail(400, 'INVALID', 'Consulta inválida.')
      })
    },

    async command(actor: Actor, key: string, input: unknown) {
      const parsed = commandSchema.safeParse(input)
      if (!parsed.success) fail(400, 'VALIDATION', 'Confira os campos: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '))
      const cmd = parsed.data!
      const teacherActions = ['item.organize', 'request.create']
      if (!teacherActions.includes(cmd.action)) adminOnly(actor)
      const fingerprint = createHash('sha256').update(JSON.stringify(cmd)).digest('hex')
      return db.transaction(async c => {
        // Serialize retries of the same command; every mutation and its audit commit together.
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key])
        const previous = await one(c, 'SELECT * FROM public.bw_school_commands WHERE id=$1', [key])
        if (previous) {
          if (previous.actor_id !== actor.id || previous.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY', 'Identificador de envio já utilizado para outra operação.')
          if (!actor.admin && 'schoolId' in cmd) await schoolAccess(c, actor, cmd.schoolId)
          return previous.result
        }
        let result: Row = {}
        let before: unknown = null
        let entityId: string = randomUUID()
        const schoolId = 'schoolId' in cmd ? cmd.schoolId : null
        let school: Row | null = null
        if (schoolId) {
          school = await schoolAccess(c, actor, schoolId, true)
          if (!school.active && !['school.update', 'school.delete', 'links.replace'].includes(cmd.action)) fail(409, 'INACTIVE', 'Reative a escola antes de alterar seu inventário.')
          if (!actor.admin && cmd.action === 'item.organize' && school.inventory_status !== 'published') fail(403, 'DRAFT', 'Inventário ainda não publicado.')
          if ('version' in cmd && !('id' in cmd)) assertVersion(school as { version: number }, cmd.version)
        }
        if (cmd.action === 'school.create') {
          const d = cmd.data
          result = await one(c, `INSERT INTO public.bw_schools (id,name,code,country,address,notes,active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [entityId,d.name,d.code,d.country,d.address,d.notes,d.active])
        } else if (cmd.action === 'school.update') {
          before = school
          const d = cmd.data
          result = await one(c, `UPDATE public.bw_schools SET name=$2,code=$3,country=$4,address=$5,notes=$6,active=$7,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`, [schoolId,d.name,d.code,d.country,d.address,d.notes,d.active])
          entityId = schoolId!
        } else if (cmd.action === 'school.delete') {
          before = school
          const used = await one(c, `SELECT (EXISTS(SELECT 1 FROM public.bw_school_teachers WHERE school_id=$1)
            OR EXISTS(SELECT 1 FROM public.bw_school_classes WHERE school_id=$1)
            OR EXISTS(SELECT 1 FROM public.bw_inventory_items WHERE school_id=$1)
            OR EXISTS(SELECT 1 FROM public.bw_inventory_requests WHERE school_id=$1)) AS used`, [schoolId])
          if (used.used) fail(409, 'HAS_HISTORY', 'Esta escola possui vínculos ou histórico. Desative-a para preservar os registros.')
          await c.query('DELETE FROM public.bw_schools WHERE id=$1', [schoolId])
          result = { deleted: true }; entityId = schoolId!
        } else if (cmd.action === 'links.replace') {
          const teachers = [...new Set(cmd.teacherIds)], classes = [...new Set(cmd.classIds)]
          // Existing class identities remain unchanged; no gradebook reconciliation is called.
          const selectedClasses = await c.query('SELECT id,teacher_id FROM public.teacher_classes WHERE id=ANY($1::uuid[]) FOR SHARE', [classes])
          const selectedTeachers = await c.query('SELECT id FROM public.teachers WHERE id=ANY($1::uuid[]) AND active AND approved FOR SHARE', [teachers])
          if (selectedClasses.length !== classes.length || selectedTeachers.length !== teachers.length) fail(400, 'INVALID_LINK', 'Selecione turmas existentes e professores ativos e aprovados.')
          if (selectedClasses.some(row => !teachers.includes(row.teacher_id))) fail(400, 'TEACHER_REQUIRED', 'Vincule também o professor responsável por cada turma selecionada.')
          const conflicts = await c.query('SELECT class_id FROM public.bw_school_classes WHERE class_id=ANY($1::uuid[]) AND school_id<>$2', [classes,schoolId])
          if (conflicts.length) fail(409, 'CLASS_LINKED', 'Uma das turmas já pertence a outra escola.')
          before = { teachers: await c.query('SELECT teacher_id FROM public.bw_school_teachers WHERE school_id=$1', [schoolId]), classes: await c.query('SELECT class_id FROM public.bw_school_classes WHERE school_id=$1', [schoolId]) }
          await c.query('DELETE FROM public.bw_school_classes WHERE school_id=$1', [schoolId])
          await c.query('DELETE FROM public.bw_school_teachers WHERE school_id=$1', [schoolId])
          for (const id of teachers) await c.query('INSERT INTO public.bw_school_teachers(school_id,teacher_id) VALUES ($1,$2)', [schoolId,id])
          for (const id of classes) await c.query('INSERT INTO public.bw_school_classes(school_id,class_id) VALUES ($1,$2)', [schoolId,id])
          await c.query('UPDATE public.bw_schools SET version=version+1,updated_at=NOW() WHERE id=$1', [schoolId])
          result = { teacherIds: teachers, classIds: classes }; entityId = schoolId!
        } else if (cmd.action === 'inventory.publish') {
          if (school!.inventory_status === 'published') fail(409, 'PUBLISHED', 'O inventário já foi publicado.')
          before = school
          result = await one(c, `UPDATE public.bw_schools SET inventory_status='published',version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`, [schoolId]); entityId = schoolId!
        } else if (cmd.action === 'item.create') {
          result = await insertItem(c, schoolId!, cmd.data); entityId = result.id
        } else if (cmd.action === 'item.update' || cmd.action === 'item.organize' || cmd.action === 'item.delete') {
          const item = await one(c, 'SELECT * FROM public.bw_inventory_items WHERE id=$1 AND school_id=$2 AND active FOR UPDATE', [cmd.id,schoolId])
          if (!item) fail(404, 'NOT_FOUND', 'Item não encontrado.')
          assertVersion(item as { version: number }, cmd.version)
          before = item; entityId = item.id
          if (cmd.action === 'item.delete') {
            result = await one(c, 'UPDATE public.bw_inventory_items SET active=FALSE,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *', [item.id])
            result.removal_reason = cmd.reason
          } else if (cmd.action === 'item.organize') {
            const d = cmd.data
            result = await one(c, 'UPDATE public.bw_inventory_items SET location=$2,condition=$3,notes=$4,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *', [item.id,d.location,d.condition,d.notes])
          } else {
            const d = cmd.data
            result = await one(c, `UPDATE public.bw_inventory_items SET name=$2,category=$3,quantity=$4,unit=$5,asset_tag=$6,serial_number=$7,location=$8,condition=$9,notes=$10,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`, [item.id,d.name,d.category,d.quantity,d.unit,d.asset_tag || null,d.serial_number,d.location,d.condition,d.notes])
          }
        } else if (cmd.action === 'request.create') {
          const d = cmd.data
          result = await one(c, `INSERT INTO public.bw_inventory_requests(id,school_id,requester_id,requester_name,kind,name,quantity,unit,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [entityId,schoolId,actor.id,actor.name,d.kind,d.name,d.quantity,d.unit,d.reason])
        } else if (cmd.action === 'request.review') {
          const request = await one(c, 'SELECT * FROM public.bw_inventory_requests WHERE id=$1 AND school_id=$2 FOR UPDATE', [cmd.id,schoolId])
          if (!request) fail(404, 'NOT_FOUND', 'Solicitação não encontrada.')
          assertVersion(request as { version: number }, cmd.version)
          const status = reviewStatus(request.kind,request.status,cmd.decision)
          before = request; entityId = request.id
          result = await one(c, 'UPDATE public.bw_inventory_requests SET status=$2,decision_notes=$3,reviewed_by=$4,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *', [request.id,status,cmd.notes,actor.id])
          if (status === 'fulfilled') {
            const item = await insertItem(c, schoolId!, { name:request.name,quantity:request.quantity,unit:request.unit,category:'',asset_tag:'',serial_number:'',location:'',condition:'good',notes:cmd.notes },request.id)
            await audit(c,actor,schoolId,'item.received',item.id,null,item)
          }
        } else if (cmd.action === 'template.apply') {
          if (school!.inventory_status !== 'draft') fail(409, 'PUBLISHED', 'Modelos só podem ser aplicados ao inventário inicial em rascunho.')
          const existing = await one(c, 'SELECT 1 FROM public.bw_inventory_items WHERE school_id=$1 LIMIT 1', [schoolId])
          if (existing) fail(409, 'NOT_EMPTY', 'O inventário já possui itens. Edite os itens existentes para evitar duplicação.')
          const template = await one(c, 'SELECT * FROM public.bw_inventory_templates WHERE id=$1 AND active FOR SHARE', [cmd.templateId])
          if (!template) fail(404, 'NOT_FOUND', 'Modelo não encontrado.')
          const created = []
          for (const value of template.items) {
            const item = await insertItem(c,schoolId!,{ ...value,asset_tag:'',serial_number:'',location:'',condition:'good',notes:'' })
            created.push(item.id)
            await audit(c,actor,schoolId,'item.from_template',item.id,null,item)
          }
          await c.query('UPDATE public.bw_schools SET version=version+1,updated_at=NOW() WHERE id=$1', [schoolId])
          result = { templateId: template.id, itemIds:created }; entityId = schoolId!
        } else if (cmd.action === 'template.create' || cmd.action === 'template.update' || cmd.action === 'template.delete') {
          if (cmd.action !== 'template.create') {
            const template = await one(c, 'SELECT * FROM public.bw_inventory_templates WHERE id=$1 FOR UPDATE', [cmd.id])
            if (!template) fail(404, 'NOT_FOUND', 'Modelo não encontrado.')
            assertVersion(template as { version: number },cmd.version); before = template; entityId = template.id
          }
          if (cmd.action === 'template.delete') {
            await c.query('DELETE FROM public.bw_inventory_templates WHERE id=$1', [entityId]); result = { deleted:true }
          } else {
            const d = cmd.data
            result = cmd.action === 'template.create'
              ? await one(c, 'INSERT INTO public.bw_inventory_templates(id,name,description,items,active) VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *', [entityId,d.name,d.description,JSON.stringify(d.items),d.active])
              : await one(c, 'UPDATE public.bw_inventory_templates SET name=$2,description=$3,items=$4::jsonb,active=$5,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *', [entityId,d.name,d.description,JSON.stringify(d.items),d.active])
          }
        }
        await audit(c,actor,cmd.action === 'school.create' ? entityId : schoolId,cmd.action,entityId,before,result)
        await c.query('INSERT INTO public.bw_school_commands(id,actor_id,fingerprint,result) VALUES ($1,$2,$3,$4::jsonb)', [key,actor.id,fingerprint,JSON.stringify(result)])
        return result
      })
    },
  }
}
