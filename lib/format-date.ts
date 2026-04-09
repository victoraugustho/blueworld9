export function formatDatePtBr(value: string | Date | null | undefined) {
  if (!value) return "-"

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-"
    return new Intl.DateTimeFormat("pt-BR").format(value)
  }

  const raw = String(value).trim()
  if (!raw) return "-"

  const isoPrefix = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoPrefix) {
    const [, year, month, day] = isoPrefix
    return `${day}/${month}/${year}`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw

  return new Intl.DateTimeFormat("pt-BR").format(parsed)
}
