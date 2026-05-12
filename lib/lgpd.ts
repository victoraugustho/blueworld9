import { db } from "@/lib/db"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"

export const LGPD_POLICY_TYPES = {
  PRIVACY_NOTICE: "privacy_notice",
  TERMS_OF_USE: "terms_of_use",
  MARKETING_COMMUNICATIONS: "marketing_communications",
} as const

export type LgpdPolicyType = (typeof LGPD_POLICY_TYPES)[keyof typeof LGPD_POLICY_TYPES]

const LGPD_DEFAULT_POLICY_VERSION = "2026.04"

type LgpdActiveVersions = Record<LgpdPolicyType, string>

export async function ensureLgpdSchema() {
  await ensureRuntimeSchema("schema:lgpd:v1", async () => {
    await db`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`

    await db`
      CREATE TABLE IF NOT EXISTS public.policy_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        policy_type TEXT NOT NULL,
        version TEXT NOT NULL,
        title TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'pt-BR',
        active BOOLEAN NOT NULL DEFAULT FALSE,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT policy_versions_policy_type_check
          CHECK (policy_type IN ('privacy_notice', 'terms_of_use', 'marketing_communications'))
      )
    `

    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS policy_versions_type_version_unique_idx
      ON public.policy_versions(policy_type, version)
    `

    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS policy_versions_type_active_unique_idx
      ON public.policy_versions(policy_type)
      WHERE active = TRUE
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_policy_acceptances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
        policy_type TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        accepted BOOLEAN NOT NULL,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip TEXT NULL,
        user_agent TEXT NULL,
        locale TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT teacher_policy_acceptances_policy_type_check
          CHECK (policy_type IN ('privacy_notice', 'terms_of_use', 'marketing_communications'))
      )
    `

    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS teacher_policy_acceptances_teacher_policy_version_unique_idx
      ON public.teacher_policy_acceptances(teacher_id, policy_type, policy_version)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_policy_acceptances_teacher_idx
      ON public.teacher_policy_acceptances(teacher_id, accepted_at DESC)
    `

    await db`
      INSERT INTO public.policy_versions (policy_type, version, title, language, active)
      SELECT 'privacy_notice', ${LGPD_DEFAULT_POLICY_VERSION}, 'Aviso de Privacidade', 'pt-BR', TRUE
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.policy_versions
        WHERE policy_type = 'privacy_notice'
          AND active = TRUE
      )
    `

    await db`
      INSERT INTO public.policy_versions (policy_type, version, title, language, active)
      SELECT 'terms_of_use', ${LGPD_DEFAULT_POLICY_VERSION}, 'Termos de Uso', 'pt-BR', TRUE
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.policy_versions
        WHERE policy_type = 'terms_of_use'
          AND active = TRUE
      )
    `

    await db`
      INSERT INTO public.policy_versions (policy_type, version, title, language, active)
      SELECT 'marketing_communications', ${LGPD_DEFAULT_POLICY_VERSION}, 'Comunicacoes e novidades', 'pt-BR', TRUE
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.policy_versions
        WHERE policy_type = 'marketing_communications'
          AND active = TRUE
      )
    `
  })
}

export async function getActiveLgpdVersions(): Promise<LgpdActiveVersions> {
  const rows = await db`
    SELECT policy_type, version
    FROM public.policy_versions
    WHERE active = TRUE
      AND policy_type IN ('privacy_notice', 'terms_of_use', 'marketing_communications')
  `

  const map: Partial<LgpdActiveVersions> = {}
  for (const row of rows) {
    const type = String(row.policy_type ?? "") as LgpdPolicyType
    const version = String(row.version ?? "").trim()
    if (!version) continue
    map[type] = version
  }

  return {
    [LGPD_POLICY_TYPES.PRIVACY_NOTICE]: map[LGPD_POLICY_TYPES.PRIVACY_NOTICE] ?? LGPD_DEFAULT_POLICY_VERSION,
    [LGPD_POLICY_TYPES.TERMS_OF_USE]: map[LGPD_POLICY_TYPES.TERMS_OF_USE] ?? LGPD_DEFAULT_POLICY_VERSION,
    [LGPD_POLICY_TYPES.MARKETING_COMMUNICATIONS]:
      map[LGPD_POLICY_TYPES.MARKETING_COMMUNICATIONS] ?? LGPD_DEFAULT_POLICY_VERSION,
  }
}

export function getRequestIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const realIp = headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return null
}
