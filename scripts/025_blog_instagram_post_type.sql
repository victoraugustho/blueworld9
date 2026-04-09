BEGIN;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS post_type TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;

UPDATE public.blog_posts
SET post_type = 'article'
WHERE post_type IS NULL;

ALTER TABLE public.blog_posts
  ALTER COLUMN post_type SET DEFAULT 'article',
  ALTER COLUMN post_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_posts_post_type_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_post_type_check
      CHECK (post_type IN ('article', 'instagram'));
  END IF;
END
$$;

COMMIT;
