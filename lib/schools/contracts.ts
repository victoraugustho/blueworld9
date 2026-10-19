import { z } from 'zod'

const text = (max: number) => z.string().trim().max(max)
const uuid = z.string().uuid()
const version = z.number().int().positive()
const quantity = z.number().int().min(0).max(100000)
export const condition = z.enum(['good', 'maintenance', 'damaged', 'missing'])
export const kitComponents = z.array(z.object({
  name:text(160).min(2), quantity:quantity.refine(v=>v>0), unit:z.enum(['un','cx','cj']),
}).strict()).max(100)
const classification = {
  category_id: uuid.optional(),
  tracking_mode: z.enum(['bulk','individual']).optional(),
}
export const itemFields = z.object({
  name: text(160).min(2), category: text(80), ...classification, quantity, unit: text(20).min(1),
  asset_tag: text(80), serial_number: text(120), location: text(160),
  condition, notes: text(4000), components:kitComponents.optional(),
}).strict().refine(v => !v.asset_tag || v.quantity <= 1, { message: 'Patrimônio individual deve ter quantidade máxima de 1.' })
const schoolFields = z.object({
  name: text(160).min(2), code: text(40).refine(v=>v.length===0||v.length>=2).transform(v => v.toUpperCase()).optional(),
  country: z.enum(['BR', 'PY', 'UY']), address: text(500), notes: text(4000), active: z.boolean(),
}).strict()
const templateFields = z.object({
  name: text(160).min(2), description: text(1000), active: z.boolean(),
  items: z.array(z.object({ name: text(160).min(2), category: text(80), ...classification, quantity, unit: text(20).min(1), components:kitComponents.optional() }).strict()).min(1).max(200),
}).strict()
const categoryFields = z.object({
  name:text(80).min(2), name_es:text(80), description:text(1000), description_es:text(1000),
  default_tracking:z.enum(['bulk','individual']), default_unit:z.enum(['un','kit','cx','cj']), active:z.boolean(),
}).strict()
const scoped = { schoolId: uuid }
const itemScope = { ...scoped, id: uuid, version }
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('school.create'), data: schoolFields }).strict(),
  z.object({ action: z.literal('school.update'), ...scoped, version, data: schoolFields }).strict(),
  z.object({ action: z.literal('school.delete'), ...scoped, version }).strict(),
  z.object({ action: z.literal('links.replace'), ...scoped, version, teacherIds: z.array(uuid).max(1000), classIds: z.array(uuid).max(1000) }).strict(),
  z.object({ action: z.literal('inventory.publish'), ...scoped, version }).strict(),
  z.object({ action: z.literal('item.create'), ...scoped, data: itemFields }).strict(),
  z.object({ action: z.literal('item.update'), ...itemScope, data: itemFields }).strict(),
  z.object({ action: z.literal('item.organize'), ...itemScope, data: z.object({ location: text(160), condition: condition.optional(), notes: text(4000) }).strict() }).strict(),
  z.object({ action:z.literal('item.condition'), ...itemScope, from:condition, to:condition, quantity:quantity.refine(v=>v>0), reason:text(1000).min(3) }).strict(),
  z.object({ action:z.literal('item.adjust'), ...itemScope, direction:z.enum(['entry','exit']), condition, quantity:quantity.refine(v=>v>0), reason:text(1000).min(3) }).strict(),
  z.object({ action:z.literal('item.individualize'), ...itemScope, reason:text(1000).min(3) }).strict(),
  z.object({ action:z.literal('asset.update'), ...itemScope, data:z.object({ condition, location:text(160), notes:text(4000), serial_number:text(120).optional(), reason:text(1000).min(3) }).strict() }).strict(),
  z.object({ action:z.literal('asset.retire'), ...itemScope, reason:text(1000).min(3) }).strict(),
  z.object({ action: z.literal('item.delete'), ...itemScope, reason: text(1000).min(3) }).strict(),
  z.object({ action: z.literal('request.create'), ...scoped, data: z.object({ kind: z.enum(['existing', 'new']), name: text(160).min(2), ...classification, quantity: quantity.refine(v => v > 0), unit: text(20).min(1), reason: text(4000).min(3), components:kitComponents.optional() }).strict() }).strict(),
  z.object({ action: z.literal('request.review'), ...itemScope, decision: z.enum(['approve', 'reject', 'fulfill']), notes: text(4000).min(3) }).strict(),
  z.object({ action: z.literal('template.create'), data: templateFields }).strict(),
  z.object({ action: z.literal('template.update'), id: uuid, version, data: templateFields }).strict(),
  z.object({ action: z.literal('template.delete'), id: uuid, version }).strict(),
  z.object({ action: z.literal('template.apply'), ...scoped, version, templateId: uuid }).strict(),
  z.object({ action:z.literal('category.create'), data:categoryFields }).strict(),
  z.object({ action:z.literal('category.update'), id:uuid, version, data:categoryFields }).strict(),
  z.object({ action:z.literal('category.delete'), id:uuid, version }).strict(),
])
export type SchoolCommand = z.infer<typeof commandSchema>
export type ItemInput = z.infer<typeof itemFields>
export type Actor = { id: string; name: string; admin: boolean }
export class SchoolError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
export function assertVersion(record: { version: number }, expected: number) {
  if (record.version !== expected) throw new SchoolError(409, 'CONFLICT', 'O registro foi alterado por outra pessoa. Atualize a página e confira os dados.')
}
export function reviewStatus(kind: string, status: string, decision: string) {
  if (status === 'pending' && decision === 'reject') return 'rejected'
  if (status === 'pending' && decision === 'approve') return kind === 'existing' ? 'fulfilled' : 'approved'
  if (status === 'approved' && decision === 'fulfill') return 'fulfilled'
  throw new SchoolError(409, 'INVALID_TRANSITION', 'Esta solicitação não permite essa decisão no estado atual.')
}
