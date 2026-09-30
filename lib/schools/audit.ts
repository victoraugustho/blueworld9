import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import type { Actor } from './contracts'

type MirrorInput = {
  req: NextRequest
  actor: Actor & { email: string; role: string; sessionId: string }
  commandKey: string
  action: string
  targetId: string
}

// Append-only integration: never runs legacy schema repair or log retention jobs.
// The authoritative audit has already committed atomically with the command.
export async function writeSchoolAuditMirror({ req, actor, commandKey, action, targetId }: MirrorInput) {
  try {
    await db`
      INSERT INTO public.audit_logs (
        id, actor_id, actor_email, actor_name, actor_role, session_id,
        action, target_type, target_id, request_method, request_path,
        status, metadata
      ) VALUES (
        ${commandKey}, ${actor.id}, ${actor.email}, ${actor.name}, ${actor.role}, ${actor.sessionId},
        ${action}, 'school', ${targetId}, ${req.method}, ${req.nextUrl.pathname},
        'success', ${JSON.stringify({ command_id: commandKey })}::jsonb
      ) ON CONFLICT (id) DO NOTHING
    `
  } catch (error) {
    console.error('[schools.audit] general audit mirror unavailable; transactional school audit preserved', error)
  }
}
