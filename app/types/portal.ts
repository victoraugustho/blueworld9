export interface Category {
  id: number
  name: string
  created_at?: string
  material_count?: number
  teacher_count?: number
  teacher_ids?: string[]
  teacher_names?: string[]
}

export interface TurmaYear {
  student_year: number
  label: string
  group: "age" | "grade" | "high"
  group_label?: string
  material_count?: number
  teacher_count?: number
  teacher_ids?: string[]
  teacher_names?: string[]
}

export type MaterialLanguage = "pt-BR" | "es"
export type MaterialAccessScope = "all" | "specific"

export interface Material {
  id: string
  title: string
  description: string
  video_notes?: string | null
  file_url: string
  file_type: "video" | "document"
  category_id: number | null
  created_at?: string
  language: MaterialLanguage
  student_year?: number | null
  access_scope?: MaterialAccessScope
  teacher_ids?: string[]
  teacher_names?: string[]
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
  country: TeacherCountry
  locale: TeacherLocale
  document_type: TeacherDocumentType
  document_number: string
  cpf?: string | null
  approved: boolean
  active?: boolean
  created_at?: string
  updated_at?: string
  role?: string | null
  category_ids?: number[]
  categories?: Category[]
  turma_count?: number
  student_years?: number[]
  turma_year_count?: number
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

export interface BugReport {
  id: string
  teacher_id: string
  title: string
  description: string
  status?: "pending" | "resolving" | "resolved"
  page_url?: string | null
  user_agent?: string | null
  created_at?: string
  teacher_name?: string
  teacher_email?: string
}
