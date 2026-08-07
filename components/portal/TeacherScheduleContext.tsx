"use client"

import { createContext, useContext, type ReactNode } from "react"

const TeacherScheduleContext = createContext<string | undefined>(undefined)

export function TeacherScheduleProvider({ teacherId, children }: { teacherId: string; children: ReactNode }) {
  return <TeacherScheduleContext.Provider value={teacherId}>{children}</TeacherScheduleContext.Provider>
}

export function useFixedTeacherScheduleId() {
  return useContext(TeacherScheduleContext)
}
