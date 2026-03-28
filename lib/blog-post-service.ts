import { db } from "@/lib/db"
import {
  buildContentHtml,
  collectContentText,
  collectPostAssetUsage,
  collectReferencedAssetIds,
  estimateReadTimeMinutes,
  fetchAssetUrlMap,
  isValidUuid,
  normalizeBlogContent,
  normalizeIntIds,
  normalizeUuidIds,
} from "@/lib/blog"

export function parseNullableDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return "invalid" as const
  return parsed
}

export function normalizeUuidOrNull(value: unknown) {
  const input = String(value ?? "").trim()
  if (!input) return null
  return isValidUuid(input) ? input : null
}

export async function ensureTeacherExists(id: string | null) {
  if (!id) return true
  const [row] = await db`
    SELECT id
    FROM teachers
    WHERE id = ${id}
    LIMIT 1
  `
  return Boolean(row?.id)
}

export async function ensureCategoryIdsExist(categoryIds: number[]) {
  if (categoryIds.length === 0) return true
  const rows = await db`
    SELECT id
    FROM blog_categories
    WHERE id = ANY(${categoryIds}::int[])
  `
  return rows.length === categoryIds.length
}

export async function ensureTagIdsExist(tagIds: number[]) {
  if (tagIds.length === 0) return true
  const rows = await db`
    SELECT id
    FROM blog_tags
    WHERE id = ANY(${tagIds}::int[])
  `
  return rows.length === tagIds.length
}

export async function ensureAssetIdsExist(assetIds: string[]) {
  if (assetIds.length === 0) return true
  const rows = await db`
    SELECT id
    FROM blog_assets
    WHERE id = ANY(${assetIds}::uuid[])
  `
  return rows.length === assetIds.length
}

export async function prepareBlogContent(
  contentInput: unknown,
  coverAssetId: string | null,
  seoImageAssetId: string | null
) {
  const content = normalizeBlogContent(contentInput)
  const content_text = collectContentText(content)
  const read_time_minutes = estimateReadTimeMinutes(content_text)

  const referencedAssetIds = new Set<string>(collectReferencedAssetIds(content))
  if (coverAssetId) referencedAssetIds.add(coverAssetId)
  if (seoImageAssetId) referencedAssetIds.add(seoImageAssetId)

  const referencedAssetIdList = normalizeUuidIds(Array.from(referencedAssetIds))
  const assetUrlMap = await fetchAssetUrlMap(referencedAssetIdList)
  const content_html = buildContentHtml(content, assetUrlMap)
  const usageRows = collectPostAssetUsage(content, coverAssetId, seoImageAssetId)

  return {
    content_json: content,
    content_html,
    content_text,
    read_time_minutes,
    usageRows,
    referencedAssetIds: referencedAssetIdList,
  }
}

export async function replacePostRelations(postId: string, categoryIds: number[], tagIds: number[]) {
  await db`
    DELETE FROM blog_post_categories
    WHERE post_id = ${postId}
  `

  if (categoryIds.length > 0) {
    await db`
      INSERT INTO blog_post_categories (post_id, category_id)
      SELECT ${postId}::uuid, UNNEST(${categoryIds}::int[])
      ON CONFLICT (post_id, category_id) DO NOTHING
    `
  }

  await db`
    DELETE FROM blog_post_tags
    WHERE post_id = ${postId}
  `

  if (tagIds.length > 0) {
    await db`
      INSERT INTO blog_post_tags (post_id, tag_id)
      SELECT ${postId}::uuid, UNNEST(${tagIds}::int[])
      ON CONFLICT (post_id, tag_id) DO NOTHING
    `
  }
}

export async function loadPostForAdmin(id: string) {
  const [row] = await db`
    SELECT
      p.*,
      cover.public_url AS cover_image_url,
      seo.public_url AS seo_image_url,
      COALESCE(
        (SELECT ARRAY_AGG(pc.category_id ORDER BY pc.category_id)
         FROM blog_post_categories pc
         WHERE pc.post_id = p.id),
        ARRAY[]::int[]
      ) AS category_ids,
      COALESCE(
        (SELECT ARRAY_AGG(pt.tag_id ORDER BY pt.tag_id)
         FROM blog_post_tags pt
         WHERE pt.post_id = p.id),
        ARRAY[]::int[]
      ) AS tag_ids,
      COALESCE(
        (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', c.id, 'name', c.name, 'slug', c.slug) ORDER BY c.name)
         FROM blog_post_categories pc
         JOIN blog_categories c ON c.id = pc.category_id
         WHERE pc.post_id = p.id),
        '[]'::jsonb
      ) AS categories,
      COALESCE(
        (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', t.id, 'name', t.name, 'slug', t.slug) ORDER BY t.name)
         FROM blog_post_tags pt
         JOIN blog_tags t ON t.id = pt.tag_id
         WHERE pt.post_id = p.id),
        '[]'::jsonb
      ) AS tags,
      COALESCE(
        (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('asset_id', pa.asset_id, 'usage_type', pa.usage_type))
         FROM blog_post_assets pa
         WHERE pa.post_id = p.id),
        '[]'::jsonb
      ) AS post_assets
    FROM blog_posts p
    LEFT JOIN blog_assets cover ON cover.id = p.cover_asset_id
    LEFT JOIN blog_assets seo ON seo.id = p.seo_image_asset_id
    WHERE p.id = ${id}
    LIMIT 1
  `

  return row ?? null
}

export function normalizePostIdArrays(body: Record<string, any>) {
  return {
    category_ids: normalizeIntIds(body.category_ids),
    tag_ids: normalizeIntIds(body.tag_ids),
  }
}
