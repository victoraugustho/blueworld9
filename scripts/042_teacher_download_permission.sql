BEGIN;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS can_download BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS teachers_can_download_idx
  ON public.teachers(can_download);

COMMIT;
