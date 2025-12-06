import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const categories = await db`
    SELECT * FROM categories ORDER BY name ASC
  `;

  return NextResponse.json(categories);
}
