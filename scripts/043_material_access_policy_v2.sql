BEGIN;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS access_policy JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'materials_access_policy_v2_check'
      AND conrelid = 'public.materials'::regclass
  ) THEN
    ALTER TABLE public.materials
      ADD CONSTRAINT materials_access_policy_v2_check
      CHECK (
        access_policy IS NULL
        OR (
          jsonb_typeof(access_policy) = 'object'
          AND access_policy->>'version' = '2'
          AND access_policy->>'mode' IN ('all', 'dynamic', 'specific')
          AND COALESCE(access_policy->>'match_strategy', 'all') IN ('all', 'any')
          AND jsonb_typeof(COALESCE(access_policy->'locales', '[]'::jsonb)) = 'array'
          AND jsonb_typeof(COALESCE(access_policy->'countries', '[]'::jsonb)) = 'array'
          AND jsonb_typeof(COALESCE(access_policy->'student_years', '[]'::jsonb)) = 'array'
          AND jsonb_typeof(COALESCE(access_policy->'category_ids', '[]'::jsonb)) = 'array'
          AND jsonb_typeof(COALESCE(access_policy->'include_teacher_ids', '[]'::jsonb)) = 'array'
          AND jsonb_typeof(COALESCE(access_policy->'exclude_teacher_ids', '[]'::jsonb)) = 'array'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS materials_access_policy_gin_idx
  ON public.materials USING GIN (access_policy)
  WHERE access_policy IS NOT NULL;

COMMIT;
