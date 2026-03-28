import { db } from "@/lib/db"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"

export async function ensureCoordinationAgendaSchema() {
  await ensureRuntimeSchema("schema:coordination_agenda_items:v1", async () => {
    await db`
      CREATE TABLE IF NOT EXISTS public.coordination_agenda_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS coordination_agenda_items_weekday_idx
      ON public.coordination_agenda_items(weekday, start_time)
    `

    await db`
      CREATE INDEX IF NOT EXISTS coordination_agenda_items_active_idx
      ON public.coordination_agenda_items(active)
    `
  })
}

export async function ensureCoordinationTasksSchema() {
  await ensureRuntimeSchema("schema:coordination_tasks:v1", async () => {
    await db`
      CREATE TABLE IF NOT EXISTS public.coordination_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        due_date DATE,
        created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS coordination_tasks_status_idx
      ON public.coordination_tasks(status)
    `

    await db`
      CREATE INDEX IF NOT EXISTS coordination_tasks_due_date_idx
      ON public.coordination_tasks(due_date)
    `
  })
}

export async function ensureCoordinationAgendaEventsSchema() {
  await ensureRuntimeSchema("schema:coordination_agenda_events:v1", async () => {
    await db`
      CREATE TABLE IF NOT EXISTS public.coordination_agenda_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        event_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS coordination_agenda_events_date_idx
      ON public.coordination_agenda_events(event_date, start_time)
    `

    await db`
      CREATE INDEX IF NOT EXISTS coordination_agenda_events_active_idx
      ON public.coordination_agenda_events(active)
    `
  })
}

