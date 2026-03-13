BEGIN;

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
);

CREATE INDEX IF NOT EXISTS coordination_agenda_items_weekday_idx
  ON public.coordination_agenda_items(weekday, start_time);

CREATE INDEX IF NOT EXISTS coordination_agenda_items_active_idx
  ON public.coordination_agenda_items(active);

INSERT INTO public.coordination_agenda_items (title, weekday, start_time, end_time, timezone, active)
SELECT v.title, v.weekday, v.start_time::time, v.end_time::time, v.timezone, TRUE
FROM (
  VALUES
    ('Reuniao de planejamento semanal', 1, '09:00', '10:00', 'America/Sao_Paulo'),
    ('Alinhamento com equipe pedagogica', 1, '14:00', '15:00', 'America/Sao_Paulo'),
    ('Follow-up de indicadores e metas', 2, '10:00', '11:00', 'America/Sao_Paulo'),
    ('Atendimento de demandas internas', 2, '15:00', '16:00', 'America/Sao_Paulo'),
    ('Revisao de comunicados e processos', 3, '09:30', '10:30', 'America/Sao_Paulo'),
    ('Checkpoint de projetos em andamento', 3, '16:00', '17:00', 'America/Sao_Paulo'),
    ('Reuniao com parceiros e suporte', 4, '11:00', '12:00', 'America/Sao_Paulo'),
    ('Organizacao administrativa do escritorio', 4, '15:30', '16:30', 'America/Sao_Paulo'),
    ('Retrospectiva da semana', 5, '10:00', '11:00', 'America/Sao_Paulo'),
    ('Planejamento da proxima semana', 5, '16:00', '17:00', 'America/Sao_Paulo')
) AS v(title, weekday, start_time, end_time, timezone)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.coordination_agenda_items a
  WHERE a.title = v.title
    AND a.weekday = v.weekday
    AND a.start_time = v.start_time::time
    AND a.end_time = v.end_time::time
);

DROP TRIGGER IF EXISTS update_coordination_agenda_items_updated_at ON public.coordination_agenda_items;
CREATE TRIGGER update_coordination_agenda_items_updated_at
BEFORE UPDATE ON public.coordination_agenda_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;
