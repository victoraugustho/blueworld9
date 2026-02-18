import Link from "next/link"
import { db } from "@/lib/db"
import { requireTeacherPage } from "@/lib/auth/server"
import { getDefaultTimezone } from "@/lib/timezones"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Home,
  User,
} from "lucide-react"

type Locale = "pt-BR" | "es"

type NotificationRow = {
  id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
}

type ReminderRow = {
  id: string
  content: string
  created_at?: string | null
  class_label?: string | null
  lesson_number?: number | null
}

type ScheduleRow = {
  id: string
  class_label: string
  weekday: number
  start_time: string
  end_time: string
  timezone: string
}

const WEEKDAY_SHORT: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

function timeLabel(value: string) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

function formatDateTime(value: string, locale: Locale) {
  try {
    return new Date(value).toLocaleString(locale === "es" ? "es-ES" : "pt-BR")
  } catch {
    return value
  }
}

function getNowParts(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const map: Record<string, string> = {}
  for (const part of parts) map[part.type] = part.value
  const weekday = WEEKDAY_SHORT[map.weekday ?? ""] ?? 1
  const hour = Number(map.hour ?? 0)
  const minute = Number(map.minute ?? 0)
  return { weekday, minutes: hour * 60 + minute }
}

function findNextSchedule(schedules: ScheduleRow[], fallbackTimezone: string) {
  let best: { schedule: ScheduleRow; offset: number; score: number } | null = null

  for (const schedule of schedules) {
    const tz = schedule.timezone || fallbackTimezone
    const now = getNowParts(tz)
    const [startH, startM] = timeLabel(schedule.start_time).split(":")
    const startMinutes = Number(startH ?? 0) * 60 + Number(startM ?? 0)

    let offset = (schedule.weekday - now.weekday + 7) % 7
    if (offset === 0 && startMinutes <= now.minutes) offset = 7

    const score = offset * 1440 + startMinutes
    if (!best || score < best.score) {
      best = { schedule, offset, score }
    }
  }

  if (!best) return null
  return { schedule: best.schedule, offset: best.offset }
}

export default async function PortalDashboardPage() {
  const teacher = await requireTeacherPage()
  const locale: Locale = teacher.locale === "es" ? "es" : "pt-BR"

  const t = {
    title: locale === "es" ? "Panel del Profesor" : "Painel do Professor",
    subtitle:
      locale === "es"
        ? "Todo lo que necesitas para hoy, en un vistazo."
        : "Tudo o que você precisa para hoje, em um só lugar.",
    reminders: locale === "es" ? "Recordatorios" : "Lembretes",
    notifications: locale === "es" ? "Notificaciones" : "Notificações",
    nextClass: locale === "es" ? "Próxima clase" : "Próxima aula",
    quickActions: locale === "es" ? "Acciones rápidas" : "Ações rápidas",
    viewAll: locale === "es" ? "Ver tudo" : "Ver tudo",
    openAgenda: locale === "es" ? "Abrir agenda" : "Abrir agenda",
    openMaterials: locale === "es" ? "Materiais" : "Materiais",
    openNotifications: locale === "es" ? "Notificaciones" : "Notificações",
    registerClass: locale === "es" ? "Registrar clase" : "Registrar aula",
    emptyReminders: locale === "es" ? "Sin recordatorios pendientes." : "Nenhum lembrete pendente.",
    emptyNotifications:
      locale === "es" ? "Sin notificaciones recientes." : "Nenhuma notificação recente.",
    emptySchedules:
      locale === "es" ? "Sin horarios cadastrados." : "Sem horários cadastrados.",
    today: locale === "es" ? "Hoy" : "Hoje",
    tomorrow: locale === "es" ? "Mañana" : "Amanhã",
  }

  const schedules: ScheduleRow[] = await db`
    SELECT id, class_label, weekday, start_time, end_time, timezone
    FROM teacher_schedules
    WHERE teacher_id = ${teacher.id}
      AND active = TRUE
    ORDER BY weekday ASC, start_time ASC
  `

  const [reminderCountRow] = await db`
    SELECT COUNT(*)::int AS total
    FROM teacher_reminders
    WHERE teacher_id = ${teacher.id}
      AND done = FALSE
  `

  const reminders: ReminderRow[] = await db`
    SELECT id, content, created_at, class_label, lesson_number
    FROM teacher_reminders
    WHERE teacher_id = ${teacher.id}
      AND done = FALSE
    ORDER BY created_at DESC
    LIMIT 3
  `

  const [unreadRow] = await db`
    SELECT COUNT(*)::int AS unread
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id AND nr.teacher_id = ${teacher.id}
    WHERE n.active = TRUE
      AND (n.expires_at IS NULL OR n.expires_at > NOW())
      AND (
        n.audience = 'all'
        OR (n.audience = 'country' AND n.country = ${teacher.country})
        OR (n.audience = 'locale' AND n.locale = ${teacher.locale})
        OR (
          n.audience = 'teacher'
          AND (
            n.teacher_id = ${teacher.id}
            OR ${teacher.id} = ANY(COALESCE(n.teacher_ids, ARRAY[]::uuid[]))
          )
        )
      )
      AND (nr.read_at IS NULL)
  `

  const notifications: NotificationRow[] = await db`
    SELECT n.id, n.title, n.message, n.created_at, (nr.read_at IS NOT NULL) AS is_read
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id AND nr.teacher_id = ${teacher.id}
    WHERE n.active = TRUE
      AND (n.expires_at IS NULL OR n.expires_at > NOW())
      AND (
        n.audience = 'all'
        OR (n.audience = 'country' AND n.country = ${teacher.country})
        OR (n.audience = 'locale' AND n.locale = ${teacher.locale})
        OR (
          n.audience = 'teacher'
          AND (
            n.teacher_id = ${teacher.id}
            OR ${teacher.id} = ANY(COALESCE(n.teacher_ids, ARRAY[]::uuid[]))
          )
        )
      )
    ORDER BY n.created_at DESC
    LIMIT 3
  `

  const fallbackTimezone = getDefaultTimezone(teacher.country)
  const nextSchedule = findNextSchedule(schedules, fallbackTimezone)

  const weekdayLabels = locale === "es"
    ? ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    : ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]

  const nextLabel = nextSchedule
    ? nextSchedule.offset === 0
      ? t.today
      : nextSchedule.offset === 1
        ? t.tomorrow
        : weekdayLabels[nextSchedule.schedule.weekday] ?? ""
    : ""

  return (
    <div className="relative min-h-screen rounded-xl bg-cyan-900/10">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl rounded-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">{teacher.name}</h1>
              <p className="text-sm text-slate-400">{teacher.email}</p>
            </div>
          </div>

          <Link href="/portal/dashboard" className="text-white/60 text-sm flex items-center gap-2">
            <Home className="w-4 h-4" />
            {t.title}
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t.title}</h2>
          <p className="text-slate-300">{t.subtitle}</p>
        </div>

        {/* Reminders + Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900/40 border border-white/10">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-300" />
                {t.reminders}
              </CardTitle>
              <span className="text-xs text-white/60">
                {(reminderCountRow?.total ?? 0)}
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {reminders.length === 0 ? (
                <p className="text-slate-400 text-sm">{t.emptyReminders}</p>
              ) : (
                reminders.map((reminder) => (
                  <div key={reminder.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    {reminder.class_label && reminder.lesson_number ? (
                      <p className="text-[11px] text-white/60 mb-1">
                        {reminder.class_label} • {t.registerClass} {reminder.lesson_number}
                      </p>
                    ) : null}
                    <p className="text-sm text-white/80 line-clamp-2">{reminder.content}</p>
                    {reminder.created_at && (
                      <p className="text-[11px] text-white/40 mt-1">
                        {formatDateTime(reminder.created_at, locale)}
                      </p>
                    )}
                  </div>
                ))
              )}

              <Link href="/portal/dashboard/agenda">
                <Button className="w-full bg-white/10 hover:bg-white/15 border border-white/10">
                  {t.viewAll}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border border-white/10">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-300" />
                {t.notifications}
              </CardTitle>
              <span className="text-xs text-white/60">{unreadRow?.unread ?? 0}</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-slate-400 text-sm">{t.emptyNotifications}</p>
              ) : (
                notifications.map((notice) => (
                  <div key={notice.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-white font-semibold line-clamp-1">{notice.title}</p>
                      {!notice.is_read && (
                        <span className="text-[10px] text-amber-200">Novo</span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 mt-1 line-clamp-2">{notice.message}</p>
                    <p className="text-[11px] text-white/40 mt-1">
                      {formatDateTime(notice.created_at, locale)}
                    </p>
                  </div>
                ))
              )}

              <Link href="/portal/dashboard/notificacoes">
                <Button className="w-full bg-white/10 hover:bg-white/15 border border-white/10">
                  {t.viewAll}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Próxima aula + Ações rápidas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900/40 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-300" />
                {t.nextClass}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!nextSchedule ? (
                <p className="text-slate-400 text-sm">{t.emptySchedules}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg text-white font-semibold">
                    {nextSchedule.schedule.class_label}
                  </p>
                  <p className="text-sm text-white/70">
                    {nextLabel} • {timeLabel(nextSchedule.schedule.start_time)} - {timeLabel(nextSchedule.schedule.end_time)}
                  </p>
                  <Link href="/portal/dashboard/agenda">
                    <Button className="mt-3 bg-cyan-600 hover:bg-cyan-700">
                      {t.openAgenda}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-300" />
                {t.quickActions}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/portal/dashboard/agenda">
                <Button className="w-full bg-cyan-600 hover:bg-cyan-700">
                  {t.registerClass}
                </Button>
              </Link>
              <Link href="/portal/dashboard/agenda">
                <Button className="w-full bg-white/10 hover:bg-white/15 border border-white/10">
                  {t.openAgenda}
                </Button>
              </Link>
              <Link href="/portal/dashboard/materiais">
                <Button className="w-full bg-white/10 hover:bg-white/15 border border-white/10">
                  {t.openMaterials}
                </Button>
              </Link>
              <Link href="/portal/dashboard/notificacoes">
                <Button className="w-full bg-white/10 hover:bg-white/15 border border-white/10">
                  {t.openNotifications}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
