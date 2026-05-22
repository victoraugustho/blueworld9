import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureGradebookSchema, isUuid, normalizeClassName } from "@/lib/gradebook"

type Mode = "transfer" | "duplicate"

type TeacherClassRow = {
  id: string
  teacher_id: string
  name: string
  student_year: number | null
  school_year: number
  active: boolean
  source_schedule_id?: string | null
}

function sanitizeMode(value: unknown): Mode | null {
  const raw = String(value ?? "").trim().toLowerCase()
  if (raw === "transfer") return "transfer"
  if (raw === "duplicate") return "duplicate"
  return null
}

async function loadClass(classId: string) {
  const [row] = await db`
    SELECT
      id,
      teacher_id,
      name,
      student_year,
      school_year,
      active,
      source_schedule_id
    FROM teacher_classes
    WHERE id = ${classId}
    LIMIT 1
  `
  return (row as TeacherClassRow | undefined) ?? null
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureGradebookSchema()

  const body = await req.json().catch(() => ({}))

  const mode = sanitizeMode(body.mode)
  const sourceClassId = String(body.source_class_id ?? "").trim()
  const targetTeacherId = String(body.target_teacher_id ?? "").trim()
  const targetClassNameInput = normalizeClassName(body.target_class_name)

  if (!mode) {
    return NextResponse.json({ error: "Modo invalido. Use transfer ou duplicate." }, { status: 400 })
  }

  if (!isUuid(sourceClassId)) {
    return NextResponse.json({ error: "Turma de origem invalida." }, { status: 400 })
  }

  if (!isUuid(targetTeacherId)) {
    return NextResponse.json({ error: "Professor de destino invalido." }, { status: 400 })
  }

  const sourceClass = await loadClass(sourceClassId)
  if (!sourceClass) {
    return NextResponse.json({ error: "Turma de origem nao encontrada." }, { status: 404 })
  }

  const [targetTeacher] = await db`
    SELECT id, name, email, active
    FROM teachers
    WHERE id = ${targetTeacherId}
    LIMIT 1
  `

  if (!targetTeacher) {
    return NextResponse.json({ error: "Professor de destino nao encontrado." }, { status: 404 })
  }

  if (targetTeacher.active === false) {
    return NextResponse.json({ error: "Professor de destino inativo." }, { status: 400 })
  }

  const targetClassName = targetClassNameInput || String(sourceClass.name ?? "").trim()
  if (!targetClassName) {
    return NextResponse.json({ error: "Nome da turma de destino invalido." }, { status: 400 })
  }

  if (mode === "transfer" && sourceClass.teacher_id === targetTeacherId && targetClassName === sourceClass.name) {
    return NextResponse.json(
      { error: "A turma ja pertence a este professor e com o mesmo nome." },
      { status: 400 },
    )
  }

  let result: any = null

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx

    if (mode === "transfer") {
      const [updatedClass] = await sql`
        UPDATE teacher_classes
        SET
          teacher_id = ${targetTeacherId},
          name = ${targetClassName},
          updated_at = NOW()
        WHERE id = ${sourceClassId}
        RETURNING id, name
      `

      if (!updatedClass) {
        throw new Error("TRANSFER_CLASS_UPDATE_FAILED")
      }

      await sql`
        UPDATE teacher_schedules
        SET
          teacher_id = ${targetTeacherId},
          class_label = ${targetClassName},
          updated_at = NOW()
        WHERE class_id = ${sourceClassId}
      `

      await sql`
        UPDATE teacher_grade_lessons
        SET
          teacher_id = ${targetTeacherId},
          updated_at = NOW()
        WHERE class_id = ${sourceClassId}
      `

      await sql`
        UPDATE teacher_lesson_logs
        SET
          teacher_id = ${targetTeacherId},
          class_label = ${targetClassName},
          updated_at = NOW()
        WHERE class_id = ${sourceClassId}
      `

      await sql`
        UPDATE teacher_reminders
        SET
          teacher_id = ${targetTeacherId},
          class_label = ${targetClassName},
          updated_at = NOW()
        WHERE class_id = ${sourceClassId}
      `

      await sql`
        UPDATE teacher_gradebook_bimester_locks
        SET locked_by_teacher_id = ${targetTeacherId}
        WHERE class_id = ${sourceClassId}
      `

      result = {
        mode: "transfer",
        class_id: String(updatedClass.id),
        class_name: String(updatedClass.name ?? targetClassName),
      }

      return
    }

    const [createdClass] = await sql`
      INSERT INTO teacher_classes (
        teacher_id,
        name,
        student_year,
        school_year,
        active
      )
      VALUES (
        ${targetTeacherId},
        ${targetClassName},
        ${sourceClass.student_year},
        ${sourceClass.school_year},
        ${sourceClass.active}
      )
      RETURNING id, name
    `

    if (!createdClass?.id) {
      throw new Error("DUPLICATE_CLASS_CREATE_FAILED")
    }

    const newClassId = String(createdClass.id)

    const sourceSchedules = await sql`
      SELECT
        id,
        class_label,
        entry_type,
        is_recurring,
        event_date,
        weekday,
        start_time,
        end_time,
        timezone,
        active,
        created_at,
        updated_at
      FROM teacher_schedules
      WHERE class_id = ${sourceClassId}
      ORDER BY created_at ASC, id ASC
    `

    const scheduleIdMap = new Map<string, string>()
    for (const schedule of sourceSchedules as any[]) {
      const [insertedSchedule] = await sql`
        INSERT INTO teacher_schedules (
          teacher_id,
          class_id,
          class_label,
          entry_type,
          is_recurring,
          event_date,
          weekday,
          start_time,
          end_time,
          timezone,
          active,
          created_at,
          updated_at
        )
        VALUES (
          ${targetTeacherId},
          ${newClassId},
          ${targetClassName},
          ${schedule.entry_type},
          ${schedule.is_recurring},
          ${schedule.event_date},
          ${schedule.weekday},
          ${schedule.start_time},
          ${schedule.end_time},
          ${schedule.timezone},
          ${schedule.active},
          ${schedule.created_at},
          ${schedule.updated_at}
        )
        RETURNING id
      `

      if (schedule?.id && insertedSchedule?.id) {
        scheduleIdMap.set(String(schedule.id), String(insertedSchedule.id))
      }
    }

    if (sourceClass.source_schedule_id) {
      const mappedSourceScheduleId = scheduleIdMap.get(String(sourceClass.source_schedule_id))
      if (mappedSourceScheduleId) {
        await sql`
          UPDATE teacher_classes
          SET source_schedule_id = ${mappedSourceScheduleId}
          WHERE id = ${newClassId}
        `
      }
    }

    const sourceStudents = await sql`
      SELECT
        id,
        full_name,
        enrollment_code,
        enrollment_at,
        active,
        created_at,
        updated_at
      FROM teacher_class_students
      WHERE class_id = ${sourceClassId}
      ORDER BY full_name ASC, created_at ASC
    `

    const studentIdMap = new Map<string, string>()
    for (const student of sourceStudents as any[]) {
      const [insertedStudent] = await sql`
        INSERT INTO teacher_class_students (
          class_id,
          full_name,
          enrollment_code,
          enrollment_at,
          active,
          created_at,
          updated_at
        )
        VALUES (
          ${newClassId},
          ${student.full_name},
          ${student.enrollment_code},
          ${student.enrollment_at},
          ${student.active},
          ${student.created_at},
          ${student.updated_at}
        )
        RETURNING id
      `

      if (student?.id && insertedStudent?.id) {
        studentIdMap.set(String(student.id), String(insertedStudent.id))
      }
    }

    const sourceGradeLessons = await sql`
      SELECT
        id,
        school_year,
        bimester,
        lesson_number,
        lesson_date,
        has_grades,
        notes,
        created_at,
        updated_at
      FROM teacher_grade_lessons
      WHERE class_id = ${sourceClassId}
      ORDER BY school_year ASC, bimester ASC, lesson_number ASC
    `

    const lessonIdMap = new Map<string, string>()
    for (const lesson of sourceGradeLessons as any[]) {
      const [insertedLesson] = await sql`
        INSERT INTO teacher_grade_lessons (
          teacher_id,
          class_id,
          school_year,
          bimester,
          lesson_number,
          lesson_date,
          has_grades,
          notes,
          created_at,
          updated_at
        )
        VALUES (
          ${targetTeacherId},
          ${newClassId},
          ${lesson.school_year},
          ${lesson.bimester},
          ${lesson.lesson_number},
          ${lesson.lesson_date},
          ${lesson.has_grades},
          ${lesson.notes},
          ${lesson.created_at},
          ${lesson.updated_at}
        )
        RETURNING id
      `

      if (lesson?.id && insertedLesson?.id) {
        lessonIdMap.set(String(lesson.id), String(insertedLesson.id))
      }
    }

    const sourceGradeEntries = await sql`
      SELECT
        lesson_id,
        student_id,
        attendance,
        c1,
        c2,
        c3,
        c4,
        comment,
        updated_at
      FROM teacher_grade_entries
      WHERE lesson_id = ANY(
        SELECT id
        FROM teacher_grade_lessons
        WHERE class_id = ${sourceClassId}
      )
    `

    for (const entry of sourceGradeEntries as any[]) {
      const mappedLessonId = lessonIdMap.get(String(entry.lesson_id))
      const mappedStudentId = studentIdMap.get(String(entry.student_id))
      if (!mappedLessonId || !mappedStudentId) continue

      await sql`
        INSERT INTO teacher_grade_entries (
          lesson_id,
          student_id,
          attendance,
          c1,
          c2,
          c3,
          c4,
          comment,
          updated_at
        )
        VALUES (
          ${mappedLessonId},
          ${mappedStudentId},
          ${entry.attendance},
          ${entry.c1},
          ${entry.c2},
          ${entry.c3},
          ${entry.c4},
          ${entry.comment},
          ${entry.updated_at}
        )
        ON CONFLICT (lesson_id, student_id)
        DO UPDATE SET
          attendance = EXCLUDED.attendance,
          c1 = EXCLUDED.c1,
          c2 = EXCLUDED.c2,
          c3 = EXCLUDED.c3,
          c4 = EXCLUDED.c4,
          comment = EXCLUDED.comment,
          updated_at = EXCLUDED.updated_at
      `
    }

    const sourceBimesterGrades = await sql`
      SELECT
        student_id,
        school_year,
        bimester,
        has_exam,
        exam_score,
        c5_score,
        manual_final_score,
        notes,
        updated_at
      FROM teacher_bimester_grades
      WHERE class_id = ${sourceClassId}
    `

    for (const grade of sourceBimesterGrades as any[]) {
      const mappedStudentId = studentIdMap.get(String(grade.student_id))
      if (!mappedStudentId) continue

      await sql`
        INSERT INTO teacher_bimester_grades (
          class_id,
          student_id,
          school_year,
          bimester,
          has_exam,
          exam_score,
          c5_score,
          manual_final_score,
          notes,
          updated_at
        )
        VALUES (
          ${newClassId},
          ${mappedStudentId},
          ${grade.school_year},
          ${grade.bimester},
          ${grade.has_exam},
          ${grade.exam_score},
          ${grade.c5_score},
          ${grade.manual_final_score},
          ${grade.notes},
          ${grade.updated_at}
        )
        ON CONFLICT (class_id, student_id, school_year, bimester)
        DO UPDATE SET
          has_exam = EXCLUDED.has_exam,
          exam_score = EXCLUDED.exam_score,
          c5_score = EXCLUDED.c5_score,
          manual_final_score = EXCLUDED.manual_final_score,
          notes = EXCLUDED.notes,
          updated_at = EXCLUDED.updated_at
      `
    }

    const sourceLocks = await sql`
      SELECT school_year, bimester, locked_at
      FROM teacher_gradebook_bimester_locks
      WHERE class_id = ${sourceClassId}
    `

    for (const lock of sourceLocks as any[]) {
      await sql`
        INSERT INTO teacher_gradebook_bimester_locks (
          class_id,
          school_year,
          bimester,
          locked_by_teacher_id,
          locked_at
        )
        VALUES (
          ${newClassId},
          ${lock.school_year},
          ${lock.bimester},
          ${targetTeacherId},
          ${lock.locked_at}
        )
        ON CONFLICT (class_id, school_year, bimester) DO NOTHING
      `
    }

    const sourceLessonLogs = await sql`
      SELECT
        schedule_id,
        school_year,
        bimester,
        lesson_number,
        lesson_date,
        has_grades,
        notes,
        observations,
        created_at,
        updated_at
      FROM teacher_lesson_logs
      WHERE class_id = ${sourceClassId}
      ORDER BY lesson_number ASC, lesson_date ASC, created_at ASC
    `

    for (const log of sourceLessonLogs as any[]) {
      const mappedScheduleId = log.schedule_id ? scheduleIdMap.get(String(log.schedule_id)) ?? null : null
      await sql`
        INSERT INTO teacher_lesson_logs (
          teacher_id,
          schedule_id,
          class_id,
          class_label,
          school_year,
          bimester,
          lesson_number,
          lesson_date,
          has_grades,
          notes,
          observations,
          created_at,
          updated_at
        )
        VALUES (
          ${targetTeacherId},
          ${mappedScheduleId},
          ${newClassId},
          ${targetClassName},
          ${log.school_year},
          ${log.bimester},
          ${log.lesson_number},
          ${log.lesson_date},
          ${log.has_grades},
          ${log.notes},
          ${log.observations},
          ${log.created_at},
          ${log.updated_at}
        )
      `
    }

    const sourceReminders = await sql`
      SELECT
        content,
        done,
        class_label,
        schedule_id,
        lesson_number,
        created_at,
        updated_at
      FROM teacher_reminders
      WHERE class_id = ${sourceClassId}
      ORDER BY created_at ASC
    `

    for (const reminder of sourceReminders as any[]) {
      const mappedScheduleId = reminder.schedule_id
        ? scheduleIdMap.get(String(reminder.schedule_id)) ?? null
        : null

      await sql`
        INSERT INTO teacher_reminders (
          teacher_id,
          content,
          done,
          class_label,
          class_id,
          schedule_id,
          lesson_number,
          created_at,
          updated_at
        )
        VALUES (
          ${targetTeacherId},
          ${reminder.content},
          ${reminder.done},
          ${targetClassName},
          ${newClassId},
          ${mappedScheduleId},
          ${reminder.lesson_number},
          ${reminder.created_at},
          ${reminder.updated_at}
        )
      `
    }

    result = {
      mode: "duplicate",
      source_class_id: sourceClassId,
      new_class_id: newClassId,
      new_class_name: String(createdClass.name ?? targetClassName),
    }
  })

  await writeAuditLog({
    req,
    action: mode === "transfer" ? "admin.teacher_classes.transfer" : "admin.teacher_classes.duplicate",
    status: "success",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: {
      type: "teacher_class",
      id: mode === "transfer" ? sourceClassId : (result as any)?.new_class_id ?? sourceClassId,
    },
    metadata: {
      mode,
      source_class_id: sourceClassId,
      source_teacher_id: sourceClass.teacher_id,
      target_teacher_id: targetTeacherId,
      target_class_name: targetClassName,
    },
  })

  if (!result) {
    return NextResponse.json({ error: "Nao foi possivel concluir a operacao." }, { status: 500 })
  }

  if (result.mode === "transfer") {
    return NextResponse.json({
      ok: true,
      mode: "transfer",
      class_id: result.class_id,
      class_name: result.class_name,
    })
  }

  return NextResponse.json({
    ok: true,
    mode: "duplicate",
    source_class_id: result.source_class_id,
    new_class_id: result.new_class_id,
    new_class_name: result.new_class_name,
  })
}
