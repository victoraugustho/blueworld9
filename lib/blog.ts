import { db } from "@/lib/db"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"
export const BLOG_LANGUAGES = ["pt-BR", "es"] as const
export const BLOG_STATUSES = ["draft", "review", "scheduled", "published", "archived"] as const
export const BLOG_ASSET_USAGE_TYPES = ["cover", "inline", "gallery", "seo"] as const

export type BlogLanguage = (typeof BLOG_LANGUAGES)[number]
export type BlogStatus = (typeof BLOG_STATUSES)[number]
export type BlogAssetUsageType = (typeof BLOG_ASSET_USAGE_TYPES)[number]

type AnyRecord = Record<string, any>
type BlogContent = { version: number; blocks: AnyRecord[] }

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function safeUrl(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  if (raw.startsWith("/") || raw.startsWith("http://") || raw.startsWith("https://")) return raw
  return null
}

function renderInlineNodes(children: unknown) {
  if (!Array.isArray(children) || children.length === 0) return ""

  return children
    .map((node) => {
      if (!isObject(node)) return ""
      let text = escapeHtml(String(node.text ?? ""))
      const marks = Array.isArray(node.marks) ? node.marks : []
      const link = safeUrl(node.href ?? node.url)

      for (const mark of marks) {
        if (mark === "bold") text = `<strong>${text}</strong>`
        if (mark === "italic") text = `<em>${text}</em>`
        if (mark === "underline") text = `<u>${text}</u>`
        if (mark === "code") text = `<code>${text}</code>`
      }

      if (marks.includes("link") && link) {
        text = `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${text}</a>`
      }

      return text
    })
    .join("")
}

function collectTextFromChildren(children: unknown) {
  if (!Array.isArray(children)) return ""
  return children
    .map((node) => {
      if (!isObject(node)) return ""
      return String(node.text ?? "")
    })
    .join(" ")
    .trim()
}

function normalizeBlock(block: unknown): AnyRecord | null {
  if (!isObject(block)) return null
  const type = String(block.type ?? "").trim()
  if (!type) return null
  return { ...block, type }
}

function normalizeContentBlocks(value: unknown): AnyRecord[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => normalizeBlock(item)).filter(Boolean) as AnyRecord[]
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function collectAssetIdsFromBlock(block: AnyRecord, set: Set<string>) {
  const directAssetId = String(block.asset_id ?? "").trim()
  if (isValidUuid(directAssetId)) set.add(directAssetId)

  if (block.type === "gallery" && Array.isArray(block.items)) {
    for (const item of block.items) {
      if (!isObject(item)) continue
      const id = String(item.asset_id ?? "").trim()
      if (isValidUuid(id)) set.add(id)
    }
  }
}

function collectUsageFromBlock(block: AnyRecord, collector: Array<{ asset_id: string; usage_type: BlogAssetUsageType }>) {
  const directAssetId = String(block.asset_id ?? "").trim()
  if (isValidUuid(directAssetId)) {
    const usage: BlogAssetUsageType = block.type === "gallery" ? "gallery" : "inline"
    collector.push({ asset_id: directAssetId, usage_type: usage })
  }

  if (block.type === "gallery" && Array.isArray(block.items)) {
    for (const item of block.items) {
      if (!isObject(item)) continue
      const id = String(item.asset_id ?? "").trim()
      if (isValidUuid(id)) {
        collector.push({ asset_id: id, usage_type: "gallery" })
      }
    }
  }
}

function renderParagraph(block: AnyRecord) {
  const inline = renderInlineNodes(block.children)
  if (inline) return `<p>${inline}</p>`
  const text = escapeHtml(String(block.text ?? "").trim())
  if (!text) return ""
  return `<p>${text}</p>`
}

function renderList(block: AnyRecord) {
  const ordered = block.ordered === true
  const items = Array.isArray(block.items) ? block.items : []
  if (items.length === 0) return ""

  const tag = ordered ? "ol" : "ul"
  const rendered = items
    .map((item) => {
      if (isObject(item)) {
        const inline = renderInlineNodes(item.children)
        if (inline) return `<li>${inline}</li>`
        return `<li>${escapeHtml(String(item.text ?? ""))}</li>`
      }
      return `<li>${escapeHtml(String(item ?? ""))}</li>`
    })
    .join("")
  return `<${tag}>${rendered}</${tag}>`
}

function renderImage(block: AnyRecord, assetUrlMap: Map<string, string>) {
  const assetId = String(block.asset_id ?? "").trim()
  const srcFromAsset = assetUrlMap.get(assetId) ?? null
  const src = safeUrl(block.url) ?? srcFromAsset
  if (!src) return ""

  const alt = escapeHtml(String(block.alt ?? ""))
  const caption = String(block.caption ?? "").trim()
  const captionHtml = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""
  return `<figure><img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />${captionHtml}</figure>`
}

function renderGallery(block: AnyRecord, assetUrlMap: Map<string, string>) {
  const items = Array.isArray(block.items) ? block.items : []
  if (items.length === 0) return ""

  const images = items
    .map((item) => {
      if (!isObject(item)) return ""
      const assetId = String(item.asset_id ?? "").trim()
      const srcFromAsset = assetUrlMap.get(assetId) ?? null
      const src = safeUrl(item.url) ?? srcFromAsset
      if (!src) return ""
      const alt = escapeHtml(String(item.alt ?? ""))
      return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />`
    })
    .filter(Boolean)

  if (images.length === 0) return ""
  return `<div class="blog-gallery">${images.join("")}</div>`
}

function renderEmbed(block: AnyRecord) {
  const provider = String(block.provider ?? "").trim().toLowerCase()
  const url = safeUrl(block.url)
  if (!url) return ""

  if (provider === "youtube") {
    return `<div class="blog-embed"><iframe src="${escapeHtml(url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`
  }

  return `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`
}

export function normalizeBlogLanguage(value: unknown): BlogLanguage {
  return value === "es" ? "es" : "pt-BR"
}

export function normalizeBlogStatus(value: unknown): BlogStatus {
  if (value === "review") return "review"
  if (value === "scheduled") return "scheduled"
  if (value === "published") return "published"
  if (value === "archived") return "archived"
  return "draft"
}

export function normalizeBlogContent(value: unknown): BlogContent {
  if (isObject(value) && Array.isArray(value.blocks)) {
    return {
      version: Number.isInteger(value.version) ? Number(value.version) : 1,
      blocks: normalizeContentBlocks(value.blocks),
    }
  }
  return { version: 1, blocks: [] }
}

export function slugify(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return ""
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 140)
}

export function isValidUuid(value: unknown) {
  const input = String(value ?? "").trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)
}

export function normalizeIntIds(value: unknown) {
  const source = Array.isArray(value) ? value : []
  const normalized = source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0)
  return Array.from(new Set(normalized))
}

export function normalizeUuidIds(value: unknown) {
  const source = Array.isArray(value) ? value : []
  const normalized = source
    .map((item) => String(item ?? "").trim())
    .filter((item) => isValidUuid(item))
  return Array.from(new Set(normalized))
}

export function collectContentText(content: BlogContent) {
  const texts: string[] = []
  for (const rawBlock of content.blocks) {
    const block = normalizeBlock(rawBlock)
    if (!block) continue

    if (["heading", "quote", "code_block", "callout", "cta"].includes(block.type)) {
      const text = String(block.text ?? "").trim()
      if (text) texts.push(text)
      continue
    }

    if (block.type === "paragraph") {
      const text = collectTextFromChildren(block.children) || String(block.text ?? "").trim()
      if (text) texts.push(text)
      continue
    }

    if (block.type === "list" && Array.isArray(block.items)) {
      for (const item of block.items) {
        if (isObject(item)) {
          const text = collectTextFromChildren(item.children) || String(item.text ?? "").trim()
          if (text) texts.push(text)
        } else {
          const text = String(item ?? "").trim()
          if (text) texts.push(text)
        }
      }
    }
  }
  return texts.join(" ").replace(/\s+/g, " ").trim()
}

export function estimateReadTimeMinutes(value: string) {
  const text = String(value ?? "").trim()
  if (!text) return 1
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

export function collectReferencedAssetIds(content: BlogContent) {
  const ids = new Set<string>()
  for (const rawBlock of content.blocks) {
    const block = normalizeBlock(rawBlock)
    if (!block) continue
    collectAssetIdsFromBlock(block, ids)
  }
  return Array.from(ids)
}

export async function fetchAssetUrlMap(assetIds: string[]) {
  if (assetIds.length === 0) return new Map<string, string>()
  const rows = await db`
    SELECT id::text AS id, public_url
    FROM blog_assets
    WHERE id = ANY(${assetIds}::uuid[])
  `
  const map = new Map<string, string>()
  for (const row of rows as any[]) {
    map.set(String(row.id), String(row.public_url))
  }
  return map
}

export function buildContentHtml(content: BlogContent, assetUrlMap: Map<string, string>) {
  const parts: string[] = []

  for (const rawBlock of content.blocks) {
    const block = normalizeBlock(rawBlock)
    if (!block) continue

    if (block.type === "heading") {
      const level = Math.min(4, Math.max(1, Number(block.level) || 2))
      const text = escapeHtml(String(block.text ?? "").trim())
      if (!text) continue
      parts.push(`<h${level}>${text}</h${level}>`)
      continue
    }

    if (block.type === "paragraph") {
      const html = renderParagraph(block)
      if (html) parts.push(html)
      continue
    }

    if (block.type === "list") {
      const html = renderList(block)
      if (html) parts.push(html)
      continue
    }

    if (block.type === "image") {
      const html = renderImage(block, assetUrlMap)
      if (html) parts.push(html)
      continue
    }

    if (block.type === "gallery") {
      const html = renderGallery(block, assetUrlMap)
      if (html) parts.push(html)
      continue
    }

    if (block.type === "quote") {
      const text = escapeHtml(String(block.text ?? "").trim())
      if (text) parts.push(`<blockquote>${text}</blockquote>`)
      continue
    }

    if (block.type === "code_block") {
      const code = escapeHtml(String(block.code ?? block.text ?? "").trim())
      if (code) parts.push(`<pre><code>${code}</code></pre>`)
      continue
    }

    if (block.type === "table" && Array.isArray(block.rows)) {
      const rows = block.rows
        .map((row: any) => {
          const cells = Array.isArray(row) ? row : []
          const rendered = cells.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")
          return rendered ? `<tr>${rendered}</tr>` : ""
        })
        .join("")
      if (rows) parts.push(`<table><tbody>${rows}</tbody></table>`)
      continue
    }

    if (block.type === "divider") {
      parts.push("<hr />")
      continue
    }

    if (block.type === "embed") {
      const html = renderEmbed(block)
      if (html) parts.push(html)
      continue
    }

    if (block.type === "callout") {
      const text = escapeHtml(String(block.text ?? "").trim())
      if (text) parts.push(`<aside class="blog-callout">${text}</aside>`)
      continue
    }

    if (block.type === "cta") {
      const text = escapeHtml(String(block.text ?? "").trim())
      const href = safeUrl(block.href)
      if (text && href) {
        parts.push(`<p><a href="${escapeHtml(href)}" class="blog-cta">${text}</a></p>`)
      } else if (text) {
        parts.push(`<p>${text}</p>`)
      }
    }
  }

  const html = parts.join("\n")
  return stripHtmlTags(html) ? html : "<p></p>"
}

export function collectPostAssetUsage(
  content: BlogContent,
  coverAssetId: string | null,
  seoImageAssetId: string | null
) {
  const usageRows: Array<{ asset_id: string; usage_type: BlogAssetUsageType }> = []

  if (isValidUuid(coverAssetId)) {
    usageRows.push({ asset_id: String(coverAssetId), usage_type: "cover" })
  }

  if (isValidUuid(seoImageAssetId)) {
    usageRows.push({ asset_id: String(seoImageAssetId), usage_type: "seo" })
  }

  for (const rawBlock of content.blocks) {
    const block = normalizeBlock(rawBlock)
    if (!block) continue
    collectUsageFromBlock(block, usageRows)
  }

  const dedupe = new Map<string, { asset_id: string; usage_type: BlogAssetUsageType }>()
  for (const item of usageRows) {
    const key = `${item.asset_id}:${item.usage_type}`
    if (!dedupe.has(key)) dedupe.set(key, item)
  }

  return Array.from(dedupe.values())
}

export async function syncPostAssetUsage(
  postId: string,
  usageRows: Array<{ asset_id: string; usage_type: BlogAssetUsageType }>
) {
  await db`
    DELETE FROM blog_post_assets
    WHERE post_id = ${postId}
  `

  if (usageRows.length === 0) return

  const asset_ids = usageRows.map((item) => item.asset_id)
  const usage_types = usageRows.map((item) => item.usage_type)

  await db`
    INSERT INTO blog_post_assets (post_id, asset_id, usage_type)
    SELECT
      ${postId}::uuid,
      UNNEST(${asset_ids}::uuid[]),
      UNNEST(${usage_types}::text[])
    ON CONFLICT (post_id, asset_id, usage_type) DO NOTHING
  `
}

export async function createBlogRevision(postId: string, createdBy: string | null) {
  const [post] = await db`
    SELECT *
    FROM blog_posts
    WHERE id = ${postId}
    LIMIT 1
  `

  if (!post) return null

  const [meta] = await db`
    SELECT
      COALESCE(
        (SELECT ARRAY_AGG(category_id ORDER BY category_id) FROM blog_post_categories WHERE post_id = ${postId}),
        ARRAY[]::int[]
      ) AS category_ids,
      COALESCE(
        (SELECT ARRAY_AGG(tag_id ORDER BY tag_id) FROM blog_post_tags WHERE post_id = ${postId}),
        ARRAY[]::int[]
      ) AS tag_ids,
      COALESCE(
        (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('asset_id', asset_id, 'usage_type', usage_type))
         FROM blog_post_assets
         WHERE post_id = ${postId}),
        '[]'::jsonb
      ) AS assets,
      COALESCE(
        (SELECT MAX(revision_number) FROM blog_post_revisions WHERE post_id = ${postId}),
        0
      )::int AS last_revision
  `

  const snapshot = {
    post,
    category_ids: Array.isArray(meta?.category_ids) ? meta.category_ids : [],
    tag_ids: Array.isArray(meta?.tag_ids) ? meta.tag_ids : [],
    assets: Array.isArray(meta?.assets) ? meta.assets : [],
  }

  const snapshotPayload = JSON.stringify(snapshot)
  const revisionNumber = Number(meta?.last_revision ?? 0) + 1

  const [revision] = await db`
    INSERT INTO blog_post_revisions (post_id, revision_number, snapshot, created_by)
    VALUES (${postId}, ${revisionNumber}, ${snapshotPayload}::jsonb, ${createdBy})
    RETURNING id, post_id, revision_number, created_at
  `

  return revision
}

export function parsePagination(input: URLSearchParams, defaults?: { pageSize?: number; maxPageSize?: number }) {
  const defaultPageSize = defaults?.pageSize ?? 20
  const maxPageSize = defaults?.maxPageSize ?? 100

  const pageRaw = Number(input.get("page") ?? 1)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1

  const pageSizeRaw = Number(input.get("page_size") ?? defaultPageSize)
  const page_size =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(maxPageSize, Math.floor(pageSizeRaw))
      : defaultPageSize

  const offset = (page - 1) * page_size

  return { page, page_size, offset }
}

export async function ensureBlogSchema() {
  await ensureRuntimeSchema("schema:blog:v1", async () => {
  await db`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`

  await db`
    CREATE TABLE IF NOT EXISTS public.blog_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS blog_categories_slug_unique_idx
    ON public.blog_categories (slug)
  `

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS blog_categories_name_unique_idx
    ON public.blog_categories (LOWER(name))
  `

  await db`
    CREATE TABLE IF NOT EXISTS public.blog_tags (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS blog_tags_slug_unique_idx
    ON public.blog_tags (slug)
  `

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS blog_tags_name_unique_idx
    ON public.blog_tags (LOWER(name))
  `

  await db`
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
    )
  `

  await db`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_language_check'
      ) THEN
        ALTER TABLE public.blog_posts
          ADD CONSTRAINT blog_posts_language_check
          CHECK (language IN ('pt-BR', 'es'));
      END IF;
    END
    $$;
  `

  await db`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_status_check'
      ) THEN
        ALTER TABLE public.blog_posts
          ADD CONSTRAINT blog_posts_status_check
          CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived'));
      END IF;
    END
    $$;
  `

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_language_unique_idx
    ON public.blog_posts (slug, language)
    WHERE deleted_at IS NULL
  `

  await db`
    CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx
    ON public.blog_posts (status, published_at DESC)
  `

  await db`
    CREATE INDEX IF NOT EXISTS blog_posts_language_published_idx
    ON public.blog_posts (language, published_at DESC)
  `

  await db`
    CREATE INDEX IF NOT EXISTS blog_posts_created_at_idx
    ON public.blog_posts (created_at DESC)
  `

  await db`
    CREATE INDEX IF NOT EXISTS blog_posts_search_idx
    ON public.blog_posts
    USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content_text, '')))
  `

  await db`
    CREATE OR REPLACE FUNCTION public.blog_posts_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `

  await db`DROP TRIGGER IF EXISTS trg_blog_posts_set_updated_at ON public.blog_posts`

  await db`
    CREATE TRIGGER trg_blog_posts_set_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.blog_posts_set_updated_at()
  `

  await db`
    CREATE TABLE IF NOT EXISTS public.blog_post_categories (
      post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
      category_id INT NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, category_id)
    )
  `

  await db`
    CREATE TABLE IF NOT EXISTS public.blog_post_tags (
      post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
      tag_id INT NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    )
  `

  await db`
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
    )
  `

  await db`
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
    )
  `

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS blog_asset_variants_asset_variant_unique_idx
    ON public.blog_asset_variants (asset_id, variant, mime_type)
  `

  await db`
    ALTER TABLE public.blog_posts
      ADD COLUMN IF NOT EXISTS cover_asset_id UUID REFERENCES public.blog_assets(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS seo_image_asset_id UUID REFERENCES public.blog_assets(id) ON DELETE SET NULL
  `

  await db`
    CREATE TABLE IF NOT EXISTS public.blog_post_assets (
      post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
      asset_id UUID NOT NULL REFERENCES public.blog_assets(id) ON DELETE CASCADE,
      usage_type TEXT NOT NULL,
      PRIMARY KEY (post_id, asset_id, usage_type)
    )
  `

  await db`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_assets_usage_type_check'
      ) THEN
        ALTER TABLE public.blog_post_assets
          ADD CONSTRAINT blog_post_assets_usage_type_check
          CHECK (usage_type IN ('cover', 'inline', 'gallery', 'seo'));
      END IF;
    END
    $$;
  `

  await db`
    CREATE TABLE IF NOT EXISTS public.blog_post_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
      revision_number INT NOT NULL,
      snapshot JSONB NOT NULL,
      created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS blog_post_revisions_post_revision_unique_idx
    ON public.blog_post_revisions (post_id, revision_number)
  `
  })
}


