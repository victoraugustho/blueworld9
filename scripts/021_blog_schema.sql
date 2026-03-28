BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.blog_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_categories_slug_unique_idx
  ON public.blog_categories (slug);

CREATE UNIQUE INDEX IF NOT EXISTS blog_categories_name_unique_idx
  ON public.blog_categories (LOWER(name));

CREATE TABLE IF NOT EXISTS public.blog_tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_tags_slug_unique_idx
  ON public.blog_tags (slug);

CREATE UNIQUE INDEX IF NOT EXISTS blog_tags_name_unique_idx
  ON public.blog_tags (LOWER(name));

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content_json JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}'::jsonb,
  content_html TEXT,
  content_text TEXT,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  first_published_at TIMESTAMPTZ,
  author_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  noindex BOOLEAN NOT NULL DEFAULT FALSE,
  read_time_minutes SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_posts_language_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_language_check
      CHECK (language IN ('pt-BR', 'es'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_posts_status_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_status_check
      CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_posts_read_time_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_read_time_check
      CHECK (read_time_minutes IS NULL OR read_time_minutes >= 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_language_unique_idx
  ON public.blog_posts (slug, language)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx
  ON public.blog_posts (status, published_at DESC);

CREATE INDEX IF NOT EXISTS blog_posts_language_published_idx
  ON public.blog_posts (language, published_at DESC);

CREATE INDEX IF NOT EXISTS blog_posts_created_at_idx
  ON public.blog_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS blog_posts_search_idx
  ON public.blog_posts
  USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content_text, '')));

CREATE OR REPLACE FUNCTION public.blog_posts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_set_updated_at ON public.blog_posts;

CREATE TRIGGER trg_blog_posts_set_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.blog_posts_set_updated_at();

CREATE TABLE IF NOT EXISTS public.blog_post_categories (
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

CREATE INDEX IF NOT EXISTS blog_post_categories_category_idx
  ON public.blog_post_categories (category_id);

CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS blog_post_tags_tag_idx
  ON public.blog_post_tags (tag_id);

COMMIT;
