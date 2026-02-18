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
  student_year?: number | null

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

export interface TeacherSchedule {
  id: string
  teacher_id: string
  class_label: string
  weekday: number
  start_time: string
  end_time: string
  timezone: string
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface TeacherLessonLog {
  id: string
  teacher_id: string
  schedule_id?: string | null
  class_label: string
  lesson_number: number
  lesson_date: string
  notes?: string | null
  observations?: string | null
  created_at?: string
  updated_at?: string
}

export interface TeacherReminder {
  id: string
  teacher_id: string
  content: string
  done: boolean
  class_label?: string | null
  lesson_number?: number | null
  created_at?: string
  updated_at?: string
}
