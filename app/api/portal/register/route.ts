import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.replace(/\D/g, "");
    const cpf = body.cpf?.replace(/\D/g, "");
    const password = body.password;

    if (!name || !email || !phone || !cpf || !password) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      );
    }

    if (cpf.length !== 11) {
      return NextResponse.json(
        { error: "CPF inválido" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Senha deve ter no mínimo 6 caracteres" },
        { status: 400 }
      );
    }

    // Verificar CPF OU email já existente
    const existing = await db`
      SELECT id FROM teachers 
      WHERE cpf = ${cpf} OR email = ${email}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "CPF ou e-mail já cadastrado" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db`
      INSERT INTO teachers (name, email, phone, cpf, password_hash, approved)
      VALUES (${name}, ${email}, ${phone}, ${cpf}, ${passwordHash}, false)
    `;

    return NextResponse.json({
      success: true,
      message: "Cadastro realizado com sucesso. Aguarde aprovação.",
    });

  } catch (err: any) {
    console.error("Registration error:", err);

    // 🔥 CASO O PROBLEMA SEJA DO BANCO
    if (err.code === "ECONNREFUSED") {
      return NextResponse.json(
        { error: "Falha ao conectar ao banco de dados." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Erro inesperado ao cadastrar." },
      { status: 500 }
    );
  }
}
