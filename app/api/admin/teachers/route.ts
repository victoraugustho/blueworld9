import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const approved = await db`
    SELECT * FROM teachers
    WHERE approved = TRUE AND active = TRUE
    ORDER BY created_at DESC
  `;

  const pending = await db`
    SELECT * FROM teachers
    WHERE approved = FALSE AND active = TRUE
    ORDER BY created_at DESC
  `;

  const disabled = await db`
    SELECT * FROM teachers
    WHERE active = FALSE
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ approved, pending, disabled });
}
