BEGIN;

ALTER TABLE public.teacher_classes
  ADD COLUMN IF NOT EXISTS source_schedule_id UUID NULL REFERENCES public.teacher_schedules(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS teacher_classes_source_schedule_unique_idx
  ON public.teacher_classes(source_schedule_id)
  WHERE source_schedule_id IS NOT NULL;

WITH one_schedule_per_class AS (
  SELECT
    s.class_id,
    MIN(s.id::text)::uuid AS schedule_id
  FROM public.teacher_schedules s
  WHERE s.entry_type = 'class'
    AND s.class_id IS NOT NULL
  GROUP BY s.class_id
  HAVING COUNT(*) = 1
)
UPDATE public.teacher_classes c
SET source_schedule_id = o.schedule_id
FROM one_schedule_per_class o
WHERE c.id = o.class_id
  AND c.source_schedule_id IS NULL;

INSERT INTO public.teacher_classes (
  teacher_id,
  name,
  school_year,
  active,
  source_schedule_id
)
SELECT
  s.teacher_id,
  trim(s.class_label) AS class_name,
  EXTRACT(YEAR FROM NOW())::smallint,
  TRUE,
  s.id
FROM public.teacher_schedules s
WHERE s.entry_type = 'class'
  AND s.class_id IS NULL
  AND s.class_label IS NOT NULL
  AND trim(s.class_label) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.teacher_classes c
    WHERE c.source_schedule_id = s.id
  );

UPDATE public.teacher_schedules s
SET class_id = c.id
FROM public.teacher_classes c
WHERE s.entry_type = 'class'
  AND s.class_id IS NULL
  AND c.source_schedule_id = s.id;

UPDATE public.teacher_schedules s
SET class_id = (
  SELECT c.id
  FROM public.teacher_classes c
  WHERE c.teacher_id = s.teacher_id
    AND lower(trim(c.name)) = lower(trim(s.class_label))
  ORDER BY c.created_at DESC
  LIMIT 1
)
WHERE s.class_id IS NULL
  AND s.entry_type = 'class'
  AND s.class_label IS NOT NULL
  AND trim(s.class_label) <> ''
  AND (
    SELECT COUNT(*)
    FROM public.teacher_classes c2
    WHERE c2.teacher_id = s.teacher_id
      AND lower(trim(c2.name)) = lower(trim(s.class_label))
  ) = 1;

WITH duplicated_schedule_classes AS (
  SELECT
    s.id AS schedule_id,
    s.class_id,
    s.teacher_id,
    trim(s.class_label) AS class_name
  FROM public.teacher_schedules s
  WHERE s.entry_type = 'class'
    AND s.class_id IS NOT NULL
    AND s.class_label IS NOT NULL
    AND trim(s.class_label) <> ''
    AND s.class_id IN (
      SELECT s2.class_id
      FROM public.teacher_schedules s2
      WHERE s2.entry_type = 'class'
        AND s2.class_id IS NOT NULL
      GROUP BY s2.class_id
      HAVING COUNT(*) > 1
    )
),
split_eligibility AS (
  SELECT
    d.schedule_id,
    d.class_id,
    d.teacher_id,
    d.class_name
  FROM duplicated_schedule_classes d
  JOIN public.teacher_classes c
    ON c.id = d.class_id
  WHERE c.source_schedule_id IS DISTINCT FROM d.schedule_id
    AND (
      (
        SELECT COUNT(*)
        FROM public.teacher_class_students cs
        WHERE cs.class_id = d.class_id
          AND cs.active = TRUE
      ) = 0
      OR (
        SELECT COUNT(*)
        FROM public.teacher_lesson_logs l
        WHERE l.schedule_id = d.schedule_id
      ) = 0
    )
)
INSERT INTO public.teacher_classes (
  teacher_id,
  name,
  school_year,
  active,
  source_schedule_id
)
SELECT
  s.teacher_id,
  s.class_name,
  EXTRACT(YEAR FROM NOW())::smallint,
  TRUE,
  s.schedule_id
FROM split_eligibility s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.teacher_classes c
  WHERE c.source_schedule_id = s.schedule_id
);

UPDATE public.teacher_schedules s
SET class_id = c.id
FROM public.teacher_classes c
WHERE s.entry_type = 'class'
  AND c.source_schedule_id = s.id
  AND s.class_id IS DISTINCT FROM c.id
  AND (
    (
      SELECT COUNT(*)
      FROM public.teacher_class_students cs
      WHERE cs.class_id = s.class_id
        AND cs.active = TRUE
    ) = 0
    OR (
      SELECT COUNT(*)
      FROM public.teacher_lesson_logs l
      WHERE l.schedule_id = s.id
    ) = 0
  );

UPDATE public.teacher_lesson_logs l
SET class_id = s.class_id
FROM public.teacher_schedules s
WHERE l.schedule_id = s.id
  AND s.class_id IS NOT NULL
  AND (l.class_id IS NULL OR l.class_id IS DISTINCT FROM s.class_id);

UPDATE public.teacher_reminders r
SET class_id = s.class_id
FROM public.teacher_schedules s
WHERE r.schedule_id = s.id
  AND s.class_id IS NOT NULL
  AND (r.class_id IS NULL OR r.class_id IS DISTINCT FROM s.class_id);

COMMIT;
