-- Extensão (se já existe, não faz nada)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- 1) notifications
-- =========================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- destino/segmentação
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'country', 'locale', 'teacher')),
  country TEXT NULL CHECK (country IN ('BR', 'UY', 'PY')),
  locale TEXT NULL CHECK (locale IN ('pt-BR', 'es')),
  teacher_id UUID NULL REFERENCES public.teachers(id) ON DELETE CASCADE,

  -- controle
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NULL,

  -- auditoria
  created_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_active_idx ON public.notifications(active);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_audience_idx ON public.notifications(audience);
CREATE INDEX IF NOT EXISTS notifications_country_idx ON public.notifications(country);
CREATE INDEX IF NOT EXISTS notifications_locale_idx ON public.notifications(locale);
CREATE INDEX IF NOT EXISTS notifications_teacher_id_idx ON public.notifications(teacher_id);

-- =========================
-- 2) notification_reads (visto/não visto por professor)
-- =========================
CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS notification_reads_teacher_idx ON public.notification_reads(teacher_id);
CREATE INDEX IF NOT EXISTS notification_reads_notification_idx ON public.notification_reads(notification_id);

-- =========================
-- Trigger updated_at (reutiliza a sua função update_updated_at_column)
-- Se sua função já existe, ok. Se não existe, cria aqui:
-- =========================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
