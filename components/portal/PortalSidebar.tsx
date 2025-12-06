"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  FileText,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Users,
} from "lucide-react";
import { useState } from "react";

export function PortalSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const teacherMenu = [
    { href: "/portal/dashboard", label: "Início", icon: Home },
    { href: "/portal/dashboard/aulas", label: "Aulas", icon: BookOpen },
    { href: "/portal/dashboard/materiais", label: "Materiais", icon: FileText },
  ];

  const adminMenu = [
    { href: "/portal/dashboard/admin/materials", label: "Materiais (Admin)", icon: ShieldCheck },
    { href: "/portal/dashboard/admin/teachers", label: "Professores", icon: Users },
  ];

  return (
    <>
      {/* BOTÃO MOBILE */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-xl 
        bg-white/10 backdrop-blur-md border border-white/20 text-white"
      >
        {open ? <X /> : <Menu />}
      </button>

      {/* SIDEBAR */}
      <aside
        className={`
          fixed z-40
          top-6 left-4
          w-72 h-[calc(100vh-3rem)]
          transform transition-all duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-[300px] md:translate-x-0"}

          bg-cyan-800/10 backdrop-blur-2xl
          border border-white/20
          rounded-2xl shadow-2xl shadow-black/20

          flex flex-col p-6
        `}
      >
        <h2 className="text-xl font-semibold text-white mb-8 tracking-wide">
          Portal do Professor
        </h2>

        {/* MENU DO PROFESSOR */}
        <nav className="flex flex-col gap-2 flex-1">
          {teacherMenu.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-300

                  ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 shadow-md shadow-cyan-500/10"
                      : "text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}

          {/* SEÇÃO DE ADMIN */}
          {isAdmin && (
            <>
              {/* Separador */}
              <div className="my-4 border-t border-white/20"></div>

              <h3 className="text-xs uppercase tracking-wider text-white/50 mb-2 pl-2">
                Administração
              </h3>

              {adminMenu.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-all duration-300

                      ${
                        active
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/20 shadow-md shadow-purple-500/10"
                          : "text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* LOGOUT */}
        <form
          action="/api/portal/logout"
          method="POST"
          className="mt-auto pt-4 border-t border-white/20"
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
            bg-red-800/50 text-red-300 border border-red-500/20
            hover:bg-red-900/60 hover:shadow-md hover:shadow-red-500/10 
            transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </form>
      </aside>
    </>
  );
}
