import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, context: any) {
  const { id } = await context.params;

  const result = await db`
    UPDATE teachers
    SET active = FALSE
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json(result[0]);
}
