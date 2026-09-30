-- Aplicar explicitamente no banco escolhido, após backup e homologação.
-- A migração é aditiva: nenhuma turma, nota, professor ou agenda é alterada.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.bw_schools (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  code TEXT NOT NULL UNIQUE CHECK (length(trim(code)) BETWEEN 2 AND 40),
  country TEXT NOT NULL CHECK (country IN ('BR', 'PY', 'UY')),
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  inventory_status TEXT NOT NULL DEFAULT 'draft' CHECK (inventory_status IN ('draft', 'published')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.bw_school_teachers (
  school_id UUID NOT NULL REFERENCES public.bw_schools(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  PRIMARY KEY (school_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS bw_school_teachers_teacher_idx ON public.bw_school_teachers(teacher_id);
CREATE TABLE IF NOT EXISTS public.bw_school_classes (
  class_id UUID PRIMARY KEY REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.bw_schools(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS bw_school_classes_school_idx ON public.bw_school_classes(school_id);

CREATE TABLE IF NOT EXISTS public.bw_inventory_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.bw_inventory_requests (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.bw_schools(id) ON DELETE RESTRICT,
  requester_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('existing', 'new')),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  unit TEXT NOT NULL DEFAULT 'un',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  decision_notes TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bw_inventory_requests_school_idx ON public.bw_inventory_requests(school_id, status, created_at DESC);
CREATE TABLE IF NOT EXISTS public.bw_inventory_items (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.bw_schools(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 0 AND 100000),
  unit TEXT NOT NULL DEFAULT 'un',
  asset_tag TEXT,
  serial_number TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'maintenance', 'damaged', 'missing')),
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  request_id UUID UNIQUE REFERENCES public.bw_inventory_requests(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (asset_tag IS NULL OR quantity <= 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS bw_inventory_items_asset_idx ON public.bw_inventory_items(upper(asset_tag)) WHERE asset_tag IS NOT NULL AND active;
CREATE INDEX IF NOT EXISTS bw_inventory_items_school_idx ON public.bw_inventory_items(school_id, active, name);

-- Histórico próprio transacional: falha na auditoria reverte a alteração inteira.
-- Sem FK em entity_id/actor_id: preserva a identificação após exclusões futuras.
CREATE TABLE IF NOT EXISTS public.bw_school_audit (
  id UUID PRIMARY KEY,
  school_id UUID,
  actor_id UUID NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bw_school_audit_scope_idx ON public.bw_school_audit(school_id, created_at DESC, id);
CREATE TABLE IF NOT EXISTS public.bw_school_commands (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL,
  fingerprint TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
