BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.blog_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  width INT,
  height INT,
  alt_default TEXT,
  caption_default TEXT,
  focal_x NUMERIC(5,2),
  focal_y NUMERIC(5,2),
  created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_assets_size_check'
  ) THEN
    ALTER TABLE public.blog_assets
      ADD CONSTRAINT blog_assets_size_check
      CHECK (size_bytes >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_assets_focal_x_check'
  ) THEN
    ALTER TABLE public.blog_assets
      ADD CONSTRAINT blog_assets_focal_x_check
      CHECK (focal_x IS NULL OR (focal_x >= 0 AND focal_x <= 100));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_assets_focal_y_check'
  ) THEN
    ALTER TABLE public.blog_assets
      ADD CONSTRAINT blog_assets_focal_y_check
      CHECK (focal_y IS NULL OR (focal_y >= 0 AND focal_y <= 100));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS blog_assets_created_at_idx
  ON public.blog_assets (created_at DESC);

CREATE INDEX IF NOT EXISTS blog_assets_mime_type_idx
  ON public.blog_assets (mime_type);

CREATE TABLE IF NOT EXISTS public.blog_asset_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.blog_assets(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  size_bytes BIGINT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_asset_variants_asset_variant_unique_idx
  ON public.blog_asset_variants (asset_id, variant, mime_type);

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS cover_asset_id UUID REFERENCES public.blog_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seo_image_asset_id UUID REFERENCES public.blog_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS blog_posts_cover_asset_idx
  ON public.blog_posts (cover_asset_id);

CREATE INDEX IF NOT EXISTS blog_posts_seo_image_asset_idx
  ON public.blog_posts (seo_image_asset_id);

CREATE TABLE IF NOT EXISTS public.blog_post_assets (
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.blog_assets(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL,
  PRIMARY KEY (post_id, asset_id, usage_type)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_post_assets_usage_type_check'
  ) THEN
    ALTER TABLE public.blog_post_assets
      ADD CONSTRAINT blog_post_assets_usage_type_check
      CHECK (usage_type IN ('cover', 'inline', 'gallery', 'seo'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS blog_post_assets_asset_idx
  ON public.blog_post_assets (asset_id);

CREATE TABLE IF NOT EXISTS public.blog_post_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_post_revisions_post_revision_unique_idx
  ON public.blog_post_revisions (post_id, revision_number);

CREATE INDEX IF NOT EXISTS blog_post_revisions_post_created_idx
  ON public.blog_post_revisions (post_id, created_at DESC);

COMMIT;
