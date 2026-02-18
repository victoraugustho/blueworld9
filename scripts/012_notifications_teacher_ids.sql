ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS teacher_ids UUID[];

UPDATE public.notifications
SET teacher_ids = ARRAY[teacher_id]
WHERE teacher_id IS NOT NULL
  AND (teacher_ids IS NULL OR array_length(teacher_ids, 1) IS NULL);

CREATE INDEX IF NOT EXISTS notifications_teacher_ids_gin_idx
  ON public.notifications USING GIN(teacher_ids);
