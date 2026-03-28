BEGIN;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS video_notes TEXT;

COMMIT;
