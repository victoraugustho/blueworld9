import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  const isAuthPage = pathname === "/" || pathname === "/cadastro";

  if (pathname.startsWith("/uploads/projects/")) {
    const filename = pathname.split("/").filter(Boolean).pop();
    if (!filename) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
    return NextResponse.rewrite(
      new URL(`/api/project-files/${encodeURIComponent(filename)}`, request.url),
    );
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/portal/dashboard", request.url));
  }

  if (pathname.startsWith("/portal/dashboard") && !session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/uploads/projects/:path*"],
};
