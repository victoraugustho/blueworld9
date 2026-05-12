BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT policy_versions_policy_type_check
    CHECK (policy_type IN ('privacy_notice', 'terms_of_use', 'marketing_communications'))
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_versions_type_version_unique_idx
  ON public.policy_versions(policy_type, version);

CREATE UNIQUE INDEX IF NOT EXISTS policy_versions_type_active_unique_idx
  ON public.policy_versions(policy_type)
  WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS public.teacher_policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip TEXT NULL,
  user_agent TEXT NULL,
  locale TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_policy_acceptances_policy_type_check
    CHECK (policy_type IN ('privacy_notice', 'terms_of_use', 'marketing_communications'))
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_policy_acceptances_teacher_policy_version_unique_idx
  ON public.teacher_policy_acceptances(teacher_id, policy_type, policy_version);

CREATE INDEX IF NOT EXISTS teacher_policy_acceptances_teacher_idx
  ON public.teacher_policy_acceptances(teacher_id, accepted_at DESC);

INSERT INTO public.policy_versions (policy_type, version, title, language, active)
SELECT 'privacy_notice', '2026.04', 'Aviso de Privacidade', 'pt-BR', TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.policy_versions
  WHERE policy_type = 'privacy_notice'
    AND active = TRUE
);

INSERT INTO public.policy_versions (policy_type, version, title, language, active)
SELECT 'terms_of_use', '2026.04', 'Termos de Uso', 'pt-BR', TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.policy_versions
  WHERE policy_type = 'terms_of_use'
    AND active = TRUE
);

INSERT INTO public.policy_versions (policy_type, version, title, language, active)
SELECT 'marketing_communications', '2026.04', 'Comunicacoes e novidades', 'pt-BR', TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.policy_versions
  WHERE policy_type = 'marketing_communications'
    AND active = TRUE
);

COMMIT;
