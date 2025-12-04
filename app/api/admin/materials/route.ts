import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const materials = await db`
    SELECT m.*, c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON c.id = m.category_id
    ORDER BY m.created_at DESC
  `;

  const categories = await db`
    SELECT * FROM categories ORDER BY name ASC
  `;

  return NextResponse.json({ materials, categories });
}

export async function POST(request: NextRequest) {
  const { title, description, file_url, file_type, category_id, new_category } =
    await request.json();

  let finalCategoryId = category_id;

  if (new_category && new_category.trim() !== "") {
    const [cat] = await db`
      INSERT INTO categories (name)
      VALUES (${new_category})
      RETURNING id
    `;
    finalCategoryId = cat.id;
  }

  await db`
    INSERT INTO materials (title, description, file_url, file_type, category_id)
    VALUES (${title}, ${description}, ${file_url}, ${file_type}, ${finalCategoryId})
  `;

  return NextResponse.json({ success: true });
}
