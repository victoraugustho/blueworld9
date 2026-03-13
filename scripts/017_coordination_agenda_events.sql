BEGIN;

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
);

CREATE INDEX IF NOT EXISTS coordination_agenda_events_date_idx
  ON public.coordination_agenda_events(event_date, start_time);

CREATE INDEX IF NOT EXISTS coordination_agenda_events_active_idx
  ON public.coordination_agenda_events(active);

DROP TRIGGER IF EXISTS update_coordination_agenda_events_updated_at ON public.coordination_agenda_events;
CREATE TRIGGER update_coordination_agenda_events_updated_at
BEFORE UPDATE ON public.coordination_agenda_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;
