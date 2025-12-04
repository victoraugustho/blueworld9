import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function middleware(request: NextRequest) {
  const teacherId = request.cookies.get("teacher_id")?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/portal/login" || pathname === "/portal/cadastro";

  if (isAuthPage && teacherId) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/portal/dashboard")) {
    if (!teacherId) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/login";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/portal/dashboard/admin")) {
      const [user] = await db`
        SELECT role FROM teachers WHERE id = ${teacherId}
      `;

      if (!user || user.role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/portal/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/portal/login",
    "/portal/cadastro",
    "/portal/dashboard/:path*",
  ],
};
