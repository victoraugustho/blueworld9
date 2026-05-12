import { db } from "@/lib/db"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"

export async function ensureAuditSchema() {
  await ensureRuntimeSchema("schema:audit:v2", async () => {
    await db`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`

    await db`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actor_id UUID NULL,
        actor_email TEXT NULL,
        actor_name TEXT NULL,
        actor_role TEXT NULL,
        session_id UUID NULL,
        action TEXT NOT NULL,
        target_type TEXT NULL,
        target_id TEXT NULL,
        request_method TEXT NULL,
        request_path TEXT NULL,
        ip TEXT NULL,
        user_agent TEXT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        metadata JSONB NULL
      )
    `

    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_email TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS session_id UUID NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_type TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_id TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS request_method TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS request_path TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT NULL`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS status TEXT`
    await db`ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB NULL`

    await db`
      UPDATE public.audit_logs
      SET status = 'success'
      WHERE status IS NULL
    `

    await db`
      ALTER TABLE public.audit_logs
      ALTER COLUMN status SET DEFAULT 'success'
    `

    await db`
      CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
      ON public.audit_logs(created_at DESC)
    `

    await db`
      CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx
      ON public.audit_logs(actor_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS audit_logs_action_idx
      ON public.audit_logs(action)
    `

    await db`
      CREATE INDEX IF NOT EXISTS audit_logs_target_idx
      ON public.audit_logs(target_type, target_id)
    `
  })
}
