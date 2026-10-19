-- Execute após 046 e 047, com backup e homologação.
-- Composição descritiva por kit: não altera saldos nem cria itens avulsos.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.bw_inventory_items
  ADD COLUMN IF NOT EXISTS components JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.bw_inventory_requests
  ADD COLUMN IF NOT EXISTS components JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.bw_inventory_items'::regclass AND conname='bw_inventory_items_components_check') THEN
    ALTER TABLE public.bw_inventory_items ADD CONSTRAINT bw_inventory_items_components_check
      CHECK (jsonb_typeof(components)='array' AND jsonb_array_length(components)<=100 AND (jsonb_array_length(components)=0 OR unit='kit'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.bw_inventory_requests'::regclass AND conname='bw_inventory_requests_components_check') THEN
    ALTER TABLE public.bw_inventory_requests ADD CONSTRAINT bw_inventory_requests_components_check
      CHECK (jsonb_typeof(components)='array' AND jsonb_array_length(components)<=100 AND (jsonb_array_length(components)=0 OR unit='kit'));
  END IF;
END $$;
COMMIT;
