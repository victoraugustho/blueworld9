import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { cpf, password } = await request.json();

    if (!cpf || !password) {
      return NextResponse.json({ error: "CPF e senha são obrigatórios" }, { status: 400 });
    }

    // Busca o teacher diretamente no Postgres
    const [teacher] = await db`
      SELECT * FROM teachers WHERE cpf = ${cpf} LIMIT 1
    `;

    if (!teacher) {
      return NextResponse.json({ error: "CPF ou senha incorretos" }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, teacher.password_hash);

    if (!passwordMatch) {
      return NextResponse.json({ error: "CPF ou senha incorretos" }, { status: 401 });
    }

    // Cria a resposta + cookie
    const response = NextResponse.json({
      success: true,
      teacherId: teacher.id,
      approved: teacher.approved,
    });

    response.cookies.set("teacher_id", teacher.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Erro ao fazer login" }, { status: 500 });
  }
}
