import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { title, description, file_url, file_type, category_id } = await request.json();

  if (!title || !file_url || !file_type) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  await db`
    INSERT INTO materials (title, description, file_url, file_type, category_id)
    VALUES (${title}, ${description}, ${file_url}, ${file_type}, ${category_id || null})
  `;

  return NextResponse.json({ success: true });
}
