export type TeacherCountry = "BR" | "UY" | "PY"

export type TimezoneOption = { value: string; label: string }

export const TIMEZONE_OPTIONS: Record<TeacherCountry, TimezoneOption[]> = {
  BR: [
    { value: "America/Sao_Paulo", label: "Bras\u00edlia (UTC-3)" },
    { value: "America/Manaus", label: "Amazonas (UTC-4)" },
    { value: "America/Rio_Branco", label: "Acre (UTC-5)" },
  ],
  UY: [{ value: "America/Montevideo", label: "Uruguai (UTC-3)" }],
  PY: [{ value: "America/Asuncion", label: "Paraguai (UTC-4)" }],
}

export function getDefaultTimezone(country: TeacherCountry) {
  return TIMEZONE_OPTIONS[country]?.[0]?.value ?? "UTC"
}

export function getTimezoneLabel(value: string) {
  for (const options of Object.values(TIMEZONE_OPTIONS)) {
    const found = options.find((opt) => opt.value === value)
    if (found) return found.label
  }
  return value
}
