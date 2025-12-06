import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { name } = await request.json();

  if (!name || name.trim() === "") {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
  }

  const [category] = await db`
    INSERT INTO categories (name)
    VALUES (${name})
    RETURNING id, name
  `;

  return NextResponse.json({ success: true, category });
}
