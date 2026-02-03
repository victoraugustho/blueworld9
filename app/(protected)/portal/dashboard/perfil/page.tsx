import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { ProfileForms } from "./ProfileForms"

export default async function PerfilPage() {
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) redirect("/portal/login")

  const [teacher] = await db`
    SELECT
      id, name, phone, locale, role, approved, active,
      email, country, document_type, document_number,
      avatar_url
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `

  if (!teacher || teacher.active === false || teacher.approved === false) {
    redirect("/portal/login")
  }

  const locale = (teacher.locale ?? "pt-BR") as "pt-BR" | "es"

  return (
    <div className="p-6 space-y-6">
      <ProfileForms
        locale={locale}
        teacher={{
          id: teacher.id,
          name: teacher.name ?? "",
          phone: teacher.phone ?? "",
          avatar_url: teacher.avatar_url ?? "",
          email: teacher.email ?? "",
          country: teacher.country ?? "",
          document_type: teacher.document_type ?? "",
          document_number: teacher.document_number ?? "",
        }}
      />
    </div>
  )
}
