import { notFound } from 'next/navigation'
import { requireTeacherPage } from '@/lib/auth/server'
import { getPortalUserRole } from '@/lib/auth/authorization'
import { getEffectivePortalLocale } from '@/lib/portal-locale'
import { schoolsEnabled } from '@/lib/schools/server'
import SchoolsClient from '@/components/schools/SchoolsClient'

export default async function SchoolsPage({ params }: { params: Promise<{ path?: string[] }> }) {
  if (!schoolsEnabled()) notFound()
  const teacher = await requireTeacherPage()
  const role = getPortalUserRole(teacher)
  if (!['admin','teacher'].includes(role)) notFound()
  const { path = [] } = await params
  const admin = role === 'admin'
  const globalPage = ['modelos','historico'].includes(path[0])
  if (path.length > 2 || (globalPage && (!admin || path.length > 1))) notFound()
  if (path[0] && !globalPage && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path[0])) notFound()
  const tab = path[0] === 'historico' ? 'audit' : path[1] ?? 'inventory'
  if (!['inventory','requests','links','audit'].includes(tab) || (!admin && tab === 'audit')) notFound()
  return <SchoolsClient key={path.join('/')} admin={admin} locale={await getEffectivePortalLocale(teacher)} schoolId={globalPage ? undefined : path[0]} templates={path[0] === 'modelos'} tab={tab} />
}
