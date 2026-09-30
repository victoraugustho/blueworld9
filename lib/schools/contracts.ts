import { z } from 'zod'

const text = (max: number) => z.string().trim().max(max)
const uuid = z.string().uuid()
const version = z.number().int().positive()
const quantity = z.number().int().min(0).max(100000)
export const itemFields = z.object({
  name: text(160).min(2), category: text(80), quantity, unit: text(20).min(1),
  asset_tag: text(80), serial_number: text(120), location: text(160),
  condition: z.enum(['good', 'maintenance', 'damaged', 'missing']), notes: text(4000),
}).strict().refine(v => !v.asset_tag || v.quantity <= 1, { message: 'Patrimônio individual deve ter quantidade máxima de 1.' })
const schoolFields = z.object({
  name: text(160).min(2), code: text(40).min(2).transform(v => v.toUpperCase()),
  country: z.enum(['BR', 'PY', 'UY']), address: text(500), notes: text(4000), active: z.boolean(),
}).strict()
const templateFields = z.object({
  name: text(160).min(2), description: text(1000), active: z.boolean(),
  items: z.array(z.object({ name: text(160).min(2), category: text(80), quantity, unit: text(20).min(1) }).strict()).min(1).max(200),
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
  z.object({ action: z.literal('item.organize'), ...itemScope, data: z.object({ location: text(160), condition: z.enum(['good', 'maintenance', 'damaged', 'missing']), notes: text(4000) }).strict() }).strict(),
  z.object({ action: z.literal('item.delete'), ...itemScope, reason: text(1000).min(3) }).strict(),
  z.object({ action: z.literal('request.create'), ...scoped, data: z.object({ kind: z.enum(['existing', 'new']), name: text(160).min(2), quantity: quantity.refine(v => v > 0), unit: text(20).min(1), reason: text(4000).min(3) }).strict() }).strict(),
  z.object({ action: z.literal('request.review'), ...itemScope, decision: z.enum(['approve', 'reject', 'fulfill']), notes: text(4000).min(3) }).strict(),
  z.object({ action: z.literal('template.create'), data: templateFields }).strict(),
  z.object({ action: z.literal('template.update'), id: uuid, version, data: templateFields }).strict(),
  z.object({ action: z.literal('template.delete'), id: uuid, version }).strict(),
  z.object({ action: z.literal('template.apply'), ...scoped, version, templateId: uuid }).strict(),
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
