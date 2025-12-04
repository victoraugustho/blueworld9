import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const teacherId = cookieStore.get("teacher_id")?.value;

  if (!teacherId) {
    redirect("/portal/login");
  }

  // Carrega o professor + role
  const [teacher] = await db`
    SELECT id, name, email, role 
    FROM teachers 
    WHERE id = ${teacherId}
  `;

  if (!teacher) {
    redirect("/portal/login");
  }

  const isAdmin = teacher.role === "admin";

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      
      {/* SIDEBAR LATERAL PROFISSIONAL */}
      <PortalSidebar isAdmin={isAdmin} />

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-10 ml-0 lg:ml-72 transition-all">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold text-white">
            Bem-vindo(a), {teacher.name}
          </h1>
          <p className="text-slate-400">{teacher.email}</p>
        </header>

        {children}
      </main>
    </div>
  );
}
