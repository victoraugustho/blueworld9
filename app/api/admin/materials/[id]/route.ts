import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET — carregar material por ID
export async function GET(req: NextRequest, context: any) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const [material] = await db`
    SELECT m.*, c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON c.id = m.category_id
    WHERE m.id = ${id}
  `;

  if (!material) {
    return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
  }

  return NextResponse.json(material);
}

// PUT — atualizar material
export async function PUT(req: NextRequest, context: any) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { title, description, file_url, file_type, category_id } = await req.json();

  const result = await db`
    UPDATE materials
    SET 
      title = ${title},
      description = ${description},
      file_url = ${file_url},
      file_type = ${file_type},
      category_id = ${category_id}
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json(result[0]);
}

// DELETE — remover material
export async function DELETE(req: NextRequest, context: any) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  await db`
    DELETE FROM materials
    WHERE id = ${id}
  `;

  return NextResponse.json({ success: true });
}
