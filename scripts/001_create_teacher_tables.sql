
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes para performance da tabela teachers
CREATE INDEX IF NOT EXISTS teachers_cpf_idx ON public.teachers(cpf);
CREATE INDEX IF NOT EXISTS teachers_email_idx ON public.teachers(email);
CREATE INDEX IF NOT EXISTS teachers_approved_idx ON public.teachers(approved);

CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  category TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL
);

-- Indexes para performance da tabela materials
CREATE INDEX IF NOT EXISTS materials_category_idx ON public.materials(category);
CREATE INDEX IF NOT EXISTS materials_file_type_idx ON public.materials(file_type);

-- Função que atualiza automaticamente o campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger aplicada na tabela teachers
CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Cria Tabela de Categoria
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- caso queira vincular materials → categories:
ALTER TABLE materials
ADD COLUMN category_id INTEGER REFERENCES categories(id);

-- Teacher Ativo Column
ALTER TABLE teachers
ADD COLUMN active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS teachers_active_idx ON teachers(active);

-- =========================================================

BEGIN;

-- 1) ENUMs (país e idioma)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_country') THEN
    CREATE TYPE teacher_country AS ENUM ('BR', 'UY', 'PY');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_language') THEN
    CREATE TYPE content_language AS ENUM ('pt-BR', 'es');
  END IF;
END $$;

-- 2) teachers: country + locale (idioma padrão)
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS country teacher_country NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS locale  content_language NOT NULL DEFAULT 'pt-BR';

CREATE INDEX IF NOT EXISTS teachers_country_idx ON public.teachers(country);
CREATE INDEX IF NOT EXISTS teachers_locale_idx  ON public.teachers(locale);

-- 3) materials: language (idioma do conteúdo)
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS language content_language NOT NULL DEFAULT 'pt-BR';

CREATE INDEX IF NOT EXISTS materials_language_idx ON public.materials(language);

-- 4) (Opcional, mas recomendado) Garantir consistência: país -> locale
--    BR => pt-BR | UY/PY => es
CREATE OR REPLACE FUNCTION public.sync_teacher_locale_from_country()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.country = 'BR' THEN
    NEW.locale := 'pt-BR';
  ELSIF NEW.country IN ('UY', 'PY') THEN
    NEW.locale := 'es';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_teacher_locale_from_country ON public.teachers;

CREATE TRIGGER trg_sync_teacher_locale_from_country
BEFORE INSERT OR UPDATE OF country ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.sync_teacher_locale_from_country();

COMMIT;
BEGIN;

-- ==================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_country') THEN
    CREATE TYPE teacher_country AS ENUM ('BR', 'UY', 'PY');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_locale') THEN
    CREATE TYPE teacher_locale AS ENUM ('pt-BR', 'es');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE document_type AS ENUM ('CPF', 'CI_UY', 'CI_PY');
  END IF;
END $$;

-- 2) Novas colunas em teachers
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS country teacher_country NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS locale teacher_locale NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS document_type document_type NOT NULL DEFAULT 'CPF',
  ADD COLUMN IF NOT EXISTS document_number TEXT;

-- 3) Migrar cpf -> document_number (para registros existentes)
UPDATE public.teachers
SET document_number = cpf
WHERE document_number IS NULL;

-- 4) document_number obrigatório
ALTER TABLE public.teachers
  ALTER COLUMN document_number SET NOT NULL;

-- 5) Índice único para (country + document_type + document_number)
--    (porque CI pode repetir entre países, e tipos são diferentes)
CREATE UNIQUE INDEX IF NOT EXISTS teachers_document_unique_idx
ON public.teachers(country, document_type, document_number);

-- 6) (Opcional) remover restrição UNIQUE do cpf e permitir NULL (para estrangeiros)
--    Se você quiser continuar guardando cpf separado, pode manter,
--    mas ele não serve mais como chave única do sistema.
ALTER TABLE public.teachers
  ALTER COLUMN cpf DROP NOT NULL;

-- Se existir unique em cpf, você pode remover para não travar estrangeiros:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teachers_cpf_key'
  ) THEN
    ALTER TABLE public.teachers DROP CONSTRAINT teachers_cpf_key;
  END IF;
END $$;

-- 7) Trigger: country define locale e document_type default
CREATE OR REPLACE FUNCTION public.sync_teacher_country_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.country = 'BR' THEN
    NEW.locale := 'pt-BR';
    NEW.document_type := 'CPF';
  ELSIF NEW.country = 'UY' THEN
    NEW.locale := 'es';
    NEW.document_type := 'CI_UY';
  ELSIF NEW.country = 'PY' THEN
    NEW.locale := 'es';
    NEW.document_type := 'CI_PY';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_teacher_country_defaults ON public.teachers;

CREATE TRIGGER trg_sync_teacher_country_defaults
BEFORE INSERT OR UPDATE OF country ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.sync_teacher_country_defaults();

COMMIT;
-- // ===================================== //
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS teachers_is_admin_idx ON teachers(is_admin);
-- // ===================================== //
ALTER TABLE materials
ALTER COLUMN language SET DEFAULT 'pt-BR';



