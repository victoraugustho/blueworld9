import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// buscar professor
export async function GET(req: NextRequest, context: any) {
  const { id } = await context.params;

  const [teacher] = await db`
    SELECT id, name, email, phone, cpf, approved, created_at, updated_at
    FROM teachers
    WHERE id = ${id}
  `;

  if (!teacher) {
    return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 });
  }

  return NextResponse.json(teacher);
}

// atualizar professor
export async function PUT(req: NextRequest, context: any) {
  const { id } = await context.params;
  const body = await req.json();

  const updated = await db`
    UPDATE teachers SET
      name = ${body.name},
      email = ${body.email},
      phone = ${body.phone},
      cpf = ${body.cpf},
      approved = ${body.approved}
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json(updated[0]);
}

// aprovar professor
export async function PATCH(req: NextRequest, context: any) {
  const { id } = await context.params;

  const result = await db`
    UPDATE teachers
    SET approved = TRUE
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json(result[0]);
}

// deletar professor
export async function DELETE(req: NextRequest, context: any) {
  const { id } = await context.params;

  await db`
    DELETE FROM teachers
    WHERE id = ${id}
  `;

  return NextResponse.json({ success: true });
}
