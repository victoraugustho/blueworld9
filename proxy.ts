import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function proxy(request: NextRequest) {

  const teacherId = request.cookies.get("teacher_id")?.value;

  // ROTAS ADMIN
  if (request.nextUrl.pathname.startsWith("/portal/dashboard/admin")) {
    if (!teacherId) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }

    const [user] = await db`
      SELECT role FROM teachers WHERE id = ${teacherId}
    `;

    if (!user || user.role !== "admin") {
      return NextResponse.redirect(new URL("/portal/dashboard", request.url));
    }
  }

  // ROTAS PROTEGIDAS
  if (request.nextUrl.pathname.startsWith("/portal/dashboard")) {
    if (!teacherId) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/portal/:path*",
  ],
};
