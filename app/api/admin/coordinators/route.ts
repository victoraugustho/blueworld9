import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth/require"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  return NextResponse.json([])
}
