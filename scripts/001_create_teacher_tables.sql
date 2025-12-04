
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
