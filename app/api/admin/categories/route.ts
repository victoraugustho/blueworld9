import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth/require";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const categories = await db`
    SELECT * FROM categories ORDER BY name ASC
  `;

  return NextResponse.json(categories);
}
