ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS student_year SMALLINT;

CREATE INDEX IF NOT EXISTS materials_student_year_idx
  ON public.materials(student_year);
