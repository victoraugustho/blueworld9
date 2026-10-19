-- Execute após 046, com backup e homologação. Não altera notas, agendas ou professores.
-- Itens antigos permanecem por quantidade; a individualização é uma ação explícita.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.bw_inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  name_es TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_es TEXT NOT NULL DEFAULT '',
  default_tracking TEXT NOT NULL DEFAULT 'bulk' CHECK (default_tracking IN ('bulk','individual')),
  default_unit TEXT NOT NULL DEFAULT 'un' CHECK (default_unit IN ('un','kit','cx','cj')),
  system BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS bw_inventory_categories_name_idx ON public.bw_inventory_categories(lower(trim(name)));
INSERT INTO public.bw_inventory_categories(id,name,name_es,default_tracking,system) VALUES
 ('b9000000-0000-4000-8000-000000000001','Geral','General','bulk',TRUE),
 ('b9000000-0000-4000-8000-000000000002','Computadores e tablets','Computadoras y tabletas','individual',FALSE),
 ('b9000000-0000-4000-8000-000000000003','Circuitos','Circuitos','individual',FALSE),
 ('b9000000-0000-4000-8000-000000000004','Robótica','Robótica','individual',FALSE),
 ('b9000000-0000-4000-8000-000000000005','Ferramentas','Herramientas','individual',FALSE),
 ('b9000000-0000-4000-8000-000000000006','Materiais de consumo','Materiales de consumo','bulk',FALSE)
ON CONFLICT DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS public.bw_inventory_item_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.bw_inventory_asset_code_seq;
ALTER TABLE public.bw_inventory_items
 ADD COLUMN IF NOT EXISTS code TEXT DEFAULT ('INV-' || nextval('public.bw_inventory_item_code_seq')::text),
 ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.bw_inventory_categories(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'bulk',
 ADD COLUMN IF NOT EXISTS good_quantity INTEGER,
 ADD COLUMN IF NOT EXISTS maintenance_quantity INTEGER,
 ADD COLUMN IF NOT EXISTS damaged_quantity INTEGER,
 ADD COLUMN IF NOT EXISTS missing_quantity INTEGER;

-- Somente registros sem referência: nomes históricos não recriam categorias renomeadas.
INSERT INTO public.bw_inventory_categories(name)
SELECT DISTINCT ON (lower(trim(name))) trim(name) FROM (
 SELECT category AS name FROM public.bw_inventory_items WHERE category_id IS NULL
 UNION ALL
 SELECT line->>'category' FROM public.bw_inventory_templates t CROSS JOIN LATERAL jsonb_array_elements(t.items) line
 WHERE NULLIF(line->>'category_id','') IS NULL
) source WHERE length(trim(name)) BETWEEN 2 AND 80
ORDER BY lower(trim(name)),trim(name) ON CONFLICT DO NOTHING;

UPDATE public.bw_inventory_items i SET category_id=COALESCE(
 (SELECT c.id FROM public.bw_inventory_categories c WHERE lower(trim(c.name))=lower(trim(i.category))),
 'b9000000-0000-4000-8000-000000000001'::uuid) WHERE category_id IS NULL;
UPDATE public.bw_inventory_items SET
 good_quantity=CASE WHEN condition='good' THEN quantity ELSE 0 END,
 maintenance_quantity=CASE WHEN condition='maintenance' THEN quantity ELSE 0 END,
 damaged_quantity=CASE WHEN condition='damaged' THEN quantity ELSE 0 END,
 missing_quantity=CASE WHEN condition='missing' THEN quantity ELSE 0 END
WHERE good_quantity IS NULL;
ALTER TABLE public.bw_inventory_items
 ALTER COLUMN code SET NOT NULL,
 ALTER COLUMN category_id SET NOT NULL,
 ALTER COLUMN good_quantity SET DEFAULT 0, ALTER COLUMN good_quantity SET NOT NULL,
 ALTER COLUMN maintenance_quantity SET DEFAULT 0, ALTER COLUMN maintenance_quantity SET NOT NULL,
 ALTER COLUMN damaged_quantity SET DEFAULT 0, ALTER COLUMN damaged_quantity SET NOT NULL,
 ALTER COLUMN missing_quantity SET DEFAULT 0, ALTER COLUMN missing_quantity SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bw_inventory_item_code_idx ON public.bw_inventory_items(code);
CREATE INDEX IF NOT EXISTS bw_inventory_category_scope_idx ON public.bw_inventory_items(school_id,category_id) WHERE active;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.bw_inventory_items'::regclass AND conname='bw_inventory_balance_check') THEN
  ALTER TABLE public.bw_inventory_items ADD CONSTRAINT bw_inventory_balance_check CHECK (
   tracking_mode IN ('bulk','individual') AND good_quantity>=0 AND maintenance_quantity>=0 AND damaged_quantity>=0 AND missing_quantity>=0
   AND quantity=good_quantity+maintenance_quantity+damaged_quantity+missing_quantity);
 END IF;
END $$;

ALTER TABLE public.bw_inventory_requests
 ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.bw_inventory_categories(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'bulk' CHECK (tracking_mode IN ('bulk','individual'));
UPDATE public.bw_inventory_requests SET category_id='b9000000-0000-4000-8000-000000000001' WHERE category_id IS NULL;
ALTER TABLE public.bw_inventory_requests ALTER COLUMN category_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.bw_inventory_assets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 item_id UUID NOT NULL REFERENCES public.bw_inventory_items(id) ON DELETE RESTRICT,
 code TEXT NOT NULL UNIQUE DEFAULT ('BW9-' || nextval('public.bw_inventory_asset_code_seq')::text),
 condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good','maintenance','damaged','missing')),
 serial_number TEXT NOT NULL DEFAULT '',
 location TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bw_inventory_assets_item_idx ON public.bw_inventory_assets(item_id,active,condition,code);

-- Completa somente campos ausentes; linhas modernas de modelos mistos são preservadas.
UPDATE public.bw_inventory_templates t SET items=(
 SELECT jsonb_agg(line
  || CASE WHEN NULLIF(line->>'category_id','') IS NULL THEN jsonb_build_object('category_id',COALESCE(
    (SELECT c.id FROM public.bw_inventory_categories c WHERE lower(trim(c.name))=lower(trim(line->>'category'))),
    'b9000000-0000-4000-8000-000000000001'::uuid)) ELSE '{}'::jsonb END
  || CASE WHEN NULLIF(line->>'tracking_mode','') IS NULL THEN jsonb_build_object('tracking_mode','bulk') ELSE '{}'::jsonb END
  ORDER BY ordinal)
 FROM jsonb_array_elements(t.items) WITH ORDINALITY parts(line,ordinal)
) WHERE jsonb_array_length(items)>0 AND EXISTS (
 SELECT 1 FROM jsonb_array_elements(t.items) line
 WHERE NULLIF(line->>'category_id','') IS NULL OR NULLIF(line->>'tracking_mode','') IS NULL);
COMMIT;
