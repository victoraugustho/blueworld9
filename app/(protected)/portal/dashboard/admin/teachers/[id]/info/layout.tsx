import { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireAdminPage } from "@/lib/auth/server"
import TeacherInfoSubnav from "./TeacherInfoSubnav"

type RouteParams = { id: string }

export default async function TeacherInfoLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<RouteParams>
}) {
  await requireAdminPage()

  const resolved = await params
  const teacherId = resolved?.id ?? ""

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 text-white">
      <div className="mb-4">
        <Link
          href="/portal/dashboard/admin/teachers"
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para professores
        </Link>
      </div>

      <TeacherInfoSubnav teacherId={teacherId} />

      {children}
    </div>
  )
}
