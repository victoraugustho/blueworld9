BEGIN;

ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.bug_reports
SET status = 'pending'
WHERE status IS NULL;

ALTER TABLE public.bug_reports
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bug_reports_status_check'
  ) THEN
    ALTER TABLE public.bug_reports
      ADD CONSTRAINT bug_reports_status_check
      CHECK (status IN ('pending', 'resolving', 'resolved'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS bug_reports_status_idx
  ON public.bug_reports(status);

CREATE INDEX IF NOT EXISTS bug_reports_status_created_at_idx
  ON public.bug_reports(status, created_at DESC);

COMMIT;
