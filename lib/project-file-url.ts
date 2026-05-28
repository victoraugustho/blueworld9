export function normalizeProjectFileUrl(rawValue: unknown) {
  const raw = String(rawValue ?? "").trim()
  if (!raw) return ""

  if (/^https?:\/\//i.test(raw)) return raw

  const normalizedSlashes = raw.replaceAll("\\", "/")
  const filename = normalizedSlashes.split("/").filter(Boolean).pop() ?? ""

  // Force project assets through API route to avoid static /uploads proxy mismatch in production.
  if (normalizedSlashes.startsWith("/uploads/") && filename) {
    return `/api/project-files/${encodeURIComponent(filename)}`
  }

  if (normalizedSlashes.startsWith("/")) return normalizedSlashes

  // Legacy rows may contain only filename (without /uploads/... prefix).
  // Route through API fallback that resolves from known uploads folders.
  if (!normalizedSlashes.includes("/")) {
    return `/api/project-files/${encodeURIComponent(normalizedSlashes)}`
  }

  if (filename) {
    return `/api/project-files/${encodeURIComponent(filename)}`
  }

  return `/${normalizedSlashes.replace(/^\/+/, "")}`
}
