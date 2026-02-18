CREATE TABLE IF NOT EXISTS public.teacher_video_progress (
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  progress_percent SMALLINT NOT NULL DEFAULT 0,
  watched_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, material_id)
);

CREATE INDEX IF NOT EXISTS teacher_video_progress_teacher_idx
  ON public.teacher_video_progress(teacher_id);

CREATE INDEX IF NOT EXISTS teacher_video_progress_material_idx
  ON public.teacher_video_progress(material_id);
