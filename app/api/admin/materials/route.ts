import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const materials = await db`
    SELECT m.*, c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON c.id = m.category_id
    ORDER BY m.created_at DESC
  `;

  return NextResponse.json(materials);
}
