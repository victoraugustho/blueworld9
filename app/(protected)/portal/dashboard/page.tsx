import { getEffectivePortalLocale } from "@/lib/portal-locale"
﻿import Link from "next/link"
import { db } from "@/lib/db"
import { requireTeacherPage } from "@/lib/auth/server"
import { getDefaultTimezone } from "@/lib/timezones"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bell,
  CheckCircle2,
  FileText,
} from "lucide-react"

type Locale = "pt-BR" | "es"

type NotificationRow = {
  id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
}

type ScheduleRow = {
  id: string
  class_label: string
  weekday: number
  start_time: string
  end_time: string
  timezone: string
}

type BlogPostRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  post_type: "article" | "instagram"
  instagram_url: string | null
  published_at: string
  cover_url: string | null
  author_name: string | null
  categories: Array<{ id: number; name: string; slug: string }>
}

type BlogCategoryFilterRow = {
  id: number
  name: string
  slug: string
  post_count: number
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

function instagramEmbedUrl(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return null

  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (!(host === "instagram.com" || host === "www.instagram.com" || host.endsWith(".instagram.com"))) return null
    const parts = parsed.pathname.split("/").filter(Boolean)
    const kind = parts[0]?.toLowerCase() === "share" ? String(parts[1] ?? "").toLowerCase() : String(parts[0] ?? "").toLowerCase()
    const code = parts[0]?.toLowerCase() === "share" ? String(parts[2] ?? "").trim() : String(parts[1] ?? "").trim()
    if (!code) return null
    if (!["p", "reel", "tv"].includes(kind)) return null
    return `https://www.instagram.com/${kind}/${code}/embed`
  } catch {
    return null
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

type PageProps = {
  searchParams?: Promise<{ blog_category?: string | string[] }> | { blog_category?: string | string[] }
}

export default async function PortalDashboardPage({ searchParams }: PageProps) {
  const teacher = await requireTeacherPage()
  const locale: Locale = await getEffectivePortalLocale(teacher)
  const resolvedSearch = await searchParams
  const categoryRaw = Array.isArray(resolvedSearch?.blog_category)
    ? resolvedSearch?.blog_category[0]
    : resolvedSearch?.blog_category
  const blogCategory = String(categoryRaw ?? "").trim()

  const t = {
    title: locale === "es" ? "Panel del Profesor" : "Painel do Professor",
    subtitle:
      locale === "es"
        ? "Todo lo que necesitas para hoy, en un vistazo."
        : "Tudo o que você precisa para hoje, em um só lugar.",
    notifications: locale === "es" ? "Notificaciones" : "Notificações",
    nextClass: locale === "es" ? "Próxima clase" : "Próxima aula",
    quickActions: locale === "es" ? "Acciones rápidas" : "Ações rápidas",
    activeSchedules: locale === "es" ? "Horarios activos" : "Horários ativos",
    unreadNotifications: locale === "es" ? "No leídas" : "Não lidas",
    quickOverview: locale === "es" ? "Vista rápida" : "Visão rápida",
    viewAll: locale === "es" ? "Ver tudo" : "Ver tudo",
    openAgenda: locale === "es" ? "Abrir agenda" : "Abrir agenda",
    openMaterials: locale === "es" ? "Materiais" : "Materiais",
    openNotifications: locale === "es" ? "Notificaciones" : "Notificações",
    registerClass: locale === "es" ? "Registrar clase" : "Registrar aula",
    emptyNotifications:
      locale === "es" ? "Sin notificaciones recientes." : "Nenhuma notificação recente.",
    emptySchedules:
      locale === "es" ? "Sin horarios cadastrados." : "Sem horários cadastrados.",
    today: locale === "es" ? "Hoy" : "Hoje",
    tomorrow: locale === "es" ? "Mañana" : "Amanhã",
    blogSection: locale === "es" ? "Blog" : "Blog",
    blogSubtitle:
      locale === "es"
        ? "Publicaciones recientes para mantenerte actualizado."
        : "Publicações recentes para você se manter atualizado.",
    blogEmpty: locale === "es" ? "Sin posts publicados por ahora." : "Nenhum post publicado no momento.",
    readMore: locale === "es" ? "Leer más" : "Leia mais",
    recentPosts: locale === "es" ? "Recientes" : "Recentes",
    featuredPost: locale === "es" ? "Post destacado" : "Post em destaque",
    categoriesLabel: locale === "es" ? "Categorias" : "Categorias",
    allCategories: locale === "es" ? "Todas las categorias" : "Todas as categorias",
    filteredBy: locale === "es" ? "Filtrado por" : "Filtrado por",
    authorLabel: locale === "es" ? "Autor" : "Autor",
    unknownAuthor: locale === "es" ? "Autor no informado" : "Autor nao informado",
    publishedAt: locale === "es" ? "Publicado em" : "Publicado em",
  }

  const schedules: ScheduleRow[] = await db`
    SELECT id, class_label, weekday, start_time, end_time, timezone
    FROM teacher_schedules
    WHERE teacher_id = ${teacher.id}
      AND active = TRUE
    ORDER BY weekday ASC, start_time ASC
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
        OR (n.audience = 'locale' AND n.locale = ${locale})
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
        OR (n.audience = 'locale' AND n.locale = ${locale})
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

  let blogPosts: BlogPostRow[] = []
  let blogCategories: BlogCategoryFilterRow[] = []
  try {
    const filters: any[] = [
      db`p.deleted_at IS NULL`,
      db`p.status = 'published'`,
      db`p.published_at IS NOT NULL`,
      db`p.published_at <= NOW()`,
    ]
    if (blogCategory) {
      filters.push(
        db`EXISTS (
          SELECT 1
          FROM blog_post_categories bpc
          JOIN blog_categories bc ON bc.id = bpc.category_id
          WHERE bpc.post_id = p.id
            AND bc.slug = ${blogCategory}
        )`
      )
    }

    const where =
      filters.length > 0
        ? db`WHERE ${filters.reduce((acc, cur, idx) => (idx === 0 ? cur : db`${acc} AND ${cur}`))}`
        : db``

    blogPosts = await db`
      SELECT
        p.id,
        p.title,
        p.slug,
        p.excerpt,
        p.post_type,
        p.instagram_url,
        p.published_at,
        cover.public_url AS cover_url,
        author.name AS author_name,
        COALESCE(
          (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', c.id, 'name', c.name, 'slug', c.slug) ORDER BY c.name)
           FROM blog_post_categories pc
           JOIN blog_categories c ON c.id = pc.category_id
           WHERE pc.post_id = p.id),
          '[]'::jsonb
        ) AS categories
      FROM blog_posts p
      LEFT JOIN blog_assets cover ON cover.id = p.cover_asset_id
      LEFT JOIN teachers author ON author.id = p.author_id
      ${where}
      ORDER BY p.published_at DESC
      LIMIT 7
    `

    blogCategories = await db`
      SELECT
        c.id,
        c.name,
        c.slug,
        COUNT(*)::int AS post_count
      FROM blog_categories c
      JOIN blog_post_categories bpc ON bpc.category_id = c.id
      JOIN blog_posts p ON p.id = bpc.post_id
      WHERE p.deleted_at IS NULL
        AND p.status = 'published'
        AND p.published_at IS NOT NULL
        AND p.published_at <= NOW()
      GROUP BY c.id, c.name, c.slug
      ORDER BY c.name ASC
    `
  } catch {
    blogPosts = []
    blogCategories = []
  }

  const featuredPost = blogPosts[0] ?? null
  const recentPosts = blogPosts.slice(featuredPost ? 1 : 0)
  const featuredInstagramEmbedUrl =
    featuredPost?.post_type === "instagram" ? instagramEmbedUrl(featuredPost.instagram_url) : null

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
  const activeSchedulesTotal = schedules.length

  return (
    <div className="relative min-h-screen rounded-xl bg-cyan-900/10">
      <main className="container mx-auto px-4 py-8 space-y-6">
        <section className="rounded-2xl border border-white/10 bg-slate-900/45 p-5 backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{t.title}</h2>
              <p className="text-slate-300">{t.subtitle}</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:w-auto">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">{t.unreadNotifications}</p>
                <p className="text-xl font-semibold text-white">{unreadRow?.unread ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">{t.activeSchedules}</p>
                <p className="text-xl font-semibold text-white">{activeSchedulesTotal}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:col-span-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">{t.nextClass}</p>
                <p className="text-sm font-semibold text-white line-clamp-1">
                  {nextSchedule ? nextSchedule.schedule.class_label : t.emptySchedules}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2 bg-slate-900/40 border border-white/10">
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
                      {!notice.is_read && <span className="text-[10px] text-amber-200">Novo</span>}
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

          <Card className="bg-slate-900/40 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-300" />
                {t.quickOverview}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-300 mb-1">{t.nextClass}</p>
                {!nextSchedule ? (
                  <p className="text-slate-400 text-sm">{t.emptySchedules}</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-white font-semibold line-clamp-1">{nextSchedule.schedule.class_label}</p>
                    <p className="text-xs text-white/70">
                      {nextLabel} • {timeLabel(nextSchedule.schedule.start_time)} - {timeLabel(nextSchedule.schedule.end_time)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-300 mb-2">{t.quickActions}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                  <Link href="/portal/dashboard/notas/lancamentos">
                    <Button className="w-full bg-cyan-600 hover:bg-cyan-700">{t.registerClass}</Button>
                  </Link>
                  <Link href="/portal/dashboard/notas/lancamentos">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Blog */}
        <Card id="blog-section" className="bg-slate-900/40 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-300" />
              {t.blogSection}
            </CardTitle>
            <p className="text-sm text-slate-300">{t.blogSubtitle}</p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <details className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                <summary className="cursor-pointer">{t.categoriesLabel}</summary>
                <div className="mt-2 flex flex-col gap-1">
                  <Link
                    href="/portal/dashboard#blog-section"
                    scroll={false}
                    className={blogCategory ? "text-slate-200 hover:text-white" : "text-cyan-300 font-semibold"}
                  >
                    {t.allCategories}
                  </Link>
                  {blogCategories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/portal/dashboard?blog_category=${encodeURIComponent(category.slug)}#blog-section`}
                      scroll={false}
                      className={
                        blogCategory === category.slug
                          ? "text-cyan-300 font-semibold"
                          : "text-slate-200 hover:text-white"
                      }
                    >
                      {category.name} ({category.post_count})
                    </Link>
                  ))}
                </div>
              </details>
              {blogCategory ? (
                <p className="text-xs text-slate-300">
                  {t.filteredBy}: <span className="text-white">{blogCategory}</span>
                </p>
              ) : null}
            </div>

            {!featuredPost ? (
              <p className="text-slate-400 text-sm">{t.blogEmpty}</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-cyan-300 mb-2">{t.featuredPost}</p>
                  <article className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    {featuredPost.cover_url ? (
                      <img src={featuredPost.cover_url} alt={featuredPost.title} className="w-full h-56 object-cover" />
                    ) : null}
                    <div className="p-4 space-y-2">
                      <h3 className="text-white text-lg font-semibold">{featuredPost.title}</h3>
                      <p className="text-xs text-slate-300">
                        {t.authorLabel}: <span className="text-white">{featuredPost.author_name || t.unknownAuthor}</span> • {t.publishedAt}:{" "}
                        <span className="text-white">{formatDateTime(featuredPost.published_at, locale)}</span>
                      </p>
                      {Array.isArray(featuredPost.categories) && featuredPost.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {featuredPost.categories.map((category) => (
                            <span key={category.id} className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-600/20 border border-cyan-400/40 text-cyan-100">
                              {category.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-600/20 border border-indigo-400/40 text-indigo-100">
                          {featuredPost.post_type === "instagram" ? "Instagram" : "Blog"}
                        </span>
                      </div>
                      {featuredInstagramEmbedUrl ? (
                        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-[9/16] w-full max-w-[420px] mx-auto">
                          <iframe
                            src={featuredInstagramEmbedUrl}
                            title={`instagram-featured-${featuredPost.id}`}
                            className="w-full h-full"
                            loading="lazy"
                            allowFullScreen
                          />
                        </div>
                      ) : null}
                      {featuredPost.excerpt ? <p className="text-sm text-slate-300 line-clamp-3">{featuredPost.excerpt}</p> : null}
                      {featuredPost.post_type === "instagram" ? (
                        featuredInstagramEmbedUrl ? null : featuredPost.instagram_url ? (
                          <a
                            href={featuredPost.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 text-sm hover:text-cyan-200"
                          >
                            Ver no Instagram
                          </a>
                        ) : null
                      ) : (
                        <Link href={`/portal/dashboard/blog/${featuredPost.slug}`} className="text-cyan-300 text-sm hover:text-cyan-200">
                          {t.readMore}
                        </Link>
                      )}
                    </div>
                  </article>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-cyan-300 mb-2">{t.recentPosts}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {recentPosts.map((post) => {
                      const postInstagramEmbedUrl =
                        post.post_type === "instagram" ? instagramEmbedUrl(post.instagram_url) : null

                      return (
                      <article key={post.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden flex flex-col">
                        {post.cover_url ? <img src={post.cover_url} alt={post.title} className="w-full h-36 object-cover" /> : null}
                        <div className="p-4 space-y-2 flex-1 flex flex-col">
                          <h3 className="text-white text-base font-semibold line-clamp-2">{post.title}</h3>
                          <p className="text-xs text-slate-300">
                            {post.author_name || t.unknownAuthor} • {formatDateTime(post.published_at, locale)}
                          </p>
                          {Array.isArray(post.categories) && post.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {post.categories.slice(0, 3).map((category) => (
                                <span key={category.id} className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-600/20 border border-cyan-400/40 text-cyan-100">
                                  {category.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {post.excerpt ? <p className="text-sm text-slate-300 line-clamp-3">{post.excerpt}</p> : <p className="text-sm text-slate-400">...</p>}
                          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-600/20 border border-indigo-400/40 text-indigo-100">
                              {post.post_type === "instagram" ? "Instagram" : "Blog"}
                            </span>
                            {post.post_type === "instagram" ? (
                              postInstagramEmbedUrl ? null : post.instagram_url ? (
                                <a
                                  href={post.instagram_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-300 text-sm hover:text-cyan-200"
                                >
                                  Ver no Instagram
                                </a>
                              ) : null
                            ) : (
                              <Link href={`/portal/dashboard/blog/${post.slug}`} className="text-cyan-300 text-sm hover:text-cyan-200">
                                {t.readMore}
                              </Link>
                            )}
                          </div>
                          {postInstagramEmbedUrl ? (
                            <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-[9/16] w-full max-w-[360px] mx-auto">
                              <iframe
                                src={postInstagramEmbedUrl}
                                title={`instagram-card-${post.id}`}
                                className="w-full h-full"
                                loading="lazy"
                                allowFullScreen
                              />
                            </div>
                          ) : null}
                        </div>
                      </article>
                    )})}
                    {recentPosts.length === 0 ? (
                      <p className="text-slate-400 text-sm">{t.blogEmpty}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

