import { cookies } from "next/headers"
import { isAdminUser } from "@/lib/auth/authorization"

export type PortalLocale = "pt-BR" | "es"

export const PORTAL_LOCALE_COOKIE = "portal_locale"

type TeacherLocaleSource = {
  locale?: string | null
  role?: string | null
  is_admin?: boolean | null
}

export function normalizePortalLocale(value: unknown): PortalLocale {
  return value === "es" ? "es" : "pt-BR"
}

export function isAdminLocaleSwitcherAllowed(teacher: TeacherLocaleSource) {
  return isAdminUser(teacher)
}

export function resolveEffectivePortalLocale(
  teacher: TeacherLocaleSource,
  cookieLocale?: string | null,
): PortalLocale {
  const defaultLocale = normalizePortalLocale(teacher.locale)
  if (!isAdminLocaleSwitcherAllowed(teacher)) return defaultLocale
  return normalizePortalLocale(cookieLocale ?? defaultLocale)
}

export async function getEffectivePortalLocale(teacher: TeacherLocaleSource): Promise<PortalLocale> {
  const cookieStore = await cookies()
  return resolveEffectivePortalLocale(teacher, cookieStore.get(PORTAL_LOCALE_COOKIE)?.value)
}
