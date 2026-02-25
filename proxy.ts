import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  const isAuthPage = pathname === "/" || pathname === "/cadastro";

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/portal/dashboard", request.url));
  }

  if (pathname.startsWith("/portal/dashboard") && !session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*"],
};
