export interface Category {
  id: number
  name: string
  created_at?: string
}

export type MaterialLanguage = "pt-BR" | "es"

export interface Material {
  id: string
  title: string
  description: string
  file_url: string
  file_type: "video" | "document"
  category_id: number | null
  created_at?: string

  // ✅ novo
  language: MaterialLanguage

  // campos adicionais da query
  category_name?: string
}

export type TeacherCountry = "BR" | "UY" | "PY"
export type TeacherLocale = "pt-BR" | "es"
export type TeacherDocumentType = "CPF" | "CI_UY" | "CI_PY"

export interface Teacher {
  id: string
  name: string
  email: string
  phone: string

  // ✅ novo modelo de documento
  country: TeacherCountry
  locale: TeacherLocale
  document_type: TeacherDocumentType
  document_number: string

  // ⚠️ legado (opcional; pode existir no banco)
  cpf?: string | null

  approved: boolean
  active?: boolean
  created_at?: string
  updated_at?: string

  // Se você ainda usa role no front, mantém opcional
  role?: string | null
}
