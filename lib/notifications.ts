import { db } from "@/lib/db"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"

export type NotificationType = "standard" | "special_modal"
export type SpecialMode = "once" | "until"

function parseSpecialNotificationCreatorIds() {
  const ids = new Set<string>()

  const combined = String(process.env.SPECIAL_NOTIFICATION_ADMIN_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  for (const id of combined) ids.add(id)

  const id1 = String(process.env.SPECIAL_NOTIFICATION_ADMIN_ID_1 ?? "").trim()
  const id2 = String(process.env.SPECIAL_NOTIFICATION_ADMIN_ID_2 ?? "").trim()
  if (id1) ids.add(id1)
  if (id2) ids.add(id2)

  return ids
}

export function canCreateSpecialNotification(teacherId: string | null | undefined) {
  if (!teacherId) return false
  return parseSpecialNotificationCreatorIds().has(teacherId)
}

export async function ensureNotificationsSchema() {
  await ensureRuntimeSchema("schema:notifications:v2", async () => {
    await db`
      ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS teacher_ids UUID[] NULL
    `

    await db`
      ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS type TEXT
    `

    await db`
      UPDATE public.notifications
      SET type = 'standard'
      WHERE type IS NULL
    `

    await db`
      ALTER TABLE public.notifications
      ALTER COLUMN type SET DEFAULT 'standard',
      ALTER COLUMN type SET NOT NULL
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'notifications_type_check'
        ) THEN
          ALTER TABLE public.notifications
          ADD CONSTRAINT notifications_type_check
          CHECK (type IN ('standard', 'special_modal'));
        END IF;
      END
      $$;
    `

    await db`
      ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS special_mode TEXT NULL
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'notifications_special_mode_check'
        ) THEN
          ALTER TABLE public.notifications
          ADD CONSTRAINT notifications_special_mode_check
          CHECK (special_mode IS NULL OR special_mode IN ('once', 'until'));
        END IF;
      END
      $$;
    `

    await db`
      CREATE INDEX IF NOT EXISTS notifications_type_active_idx
      ON public.notifications(type, active, created_at DESC)
    `
  })
}

