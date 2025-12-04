import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.redirect(process.env.NEXT_PUBLIC_SITE_URL + "/portal/login")
  response.cookies.set("teacher_id", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}
