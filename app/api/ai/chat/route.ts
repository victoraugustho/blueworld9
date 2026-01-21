import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type Role = "user" | "assistant" | "system"
type Locale = "pt-BR" | "es"

function buildSystemPrompt(params: { mode: "teacher" | "admin"; locale: Locale; aiName: string }) {
  const { mode, locale, aiName } = params

  const langRule =
    locale === "es"
      ? "Idioma: responda SEMPRE em espanhol."
      : "Idioma: responda SEMPRE em português do Brasil."

  return `
Você é ${aiName}, um assistente conversacional dentro do Portal do Professor (BlueWorld9).

REGRAS IMPORTANTES:
- Você NÃO executa ações no sistema. Você apenas conversa e orienta.
- Responda de forma objetiva, prática e clara.
- Não invente dados; se faltar informação, faça perguntas curtas.
- Quando sugerir algo (aula/atividade/texto), entregue em formato pronto para usar.

DIREÇÃO POR MODO:
- Se o modo for "admin": você pode sugerir textos de notificações, organização do portal e boas práticas administrativas.
- Se o modo for "teacher": foque em apoio pedagógico, planejamento, atividades e uso do portal.

${langRule}
Modo atual: ${mode}
  `.trim()
}

async function getOrCreateConversation(teacherId: string) {
  const [conv] = await db`
    SELECT id, summary
    FROM ai_conversations
    WHERE teacher_id = ${teacherId}
    ORDER BY created_at ASC
    LIMIT 1
  `

  if (conv) return conv

  const [created] = await db`
    INSERT INTO ai_conversations (teacher_id, title, summary)
    VALUES (${teacherId}, 'Conversa', '')
    RETURNING id, summary
  `
  return created
}

async function loadRecentMessages(conversationId: string, limit = 30) {
  const rows = await db`
    SELECT role, content
    FROM ai_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows.reverse() as { role: Role; content: string }[]
}

async function countMessages(conversationId: string) {
  const [row] = await db`
    SELECT COUNT(*)::int AS count
    FROM ai_messages
    WHERE conversation_id = ${conversationId}
  `
  return row?.count ?? 0
}

async function maybeUpdateSummary(conversationId: string) {
  const total = await countMessages(conversationId)
  if (total % 20 !== 0) return

  const [conv] = await db`
    SELECT summary
    FROM ai_conversations
    WHERE id = ${conversationId}
    LIMIT 1
  `
  const summary = conv?.summary ?? ""

  const last = await loadRecentMessages(conversationId, 40)

  const prompt = [
    {
      role: "system" as const,
      content:
        "Você atualiza um resumo de conversa. Devolva um resumo curto e útil, com fatos, preferências e pendências. Sem inventar.",
    },
    {
      role: "user" as const,
      content: `Resumo atual:\n${summary || "(vazio)"}\n\nNovas mensagens:\n${last
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n")}\n\nAtualize o resumo:`,
    },
  ]

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: prompt,
  })

  const newSummary = r.choices?.[0]?.message?.content?.trim() ?? summary

  await db`
    UPDATE ai_conversations
    SET summary = ${newSummary}
    WHERE id = ${conversationId}
  `
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const teacherId = cookieStore.get("teacher_id")?.value
    if (!teacherId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json()

    const message = String(body?.message ?? "").trim()
    if (!message) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })

    const mode = (body?.mode === "admin" ? "admin" : "teacher") as "teacher" | "admin"

    // ✅ locale vem do front, mas garantimos um fallback seguro
    const locale = (body?.locale === "es" ? "es" : "pt-BR") as Locale

    // ✅ nome da IA (fallback fixo)
    const aiName = String(body?.aiName ?? "BW9 AI").trim() || "BW9 AI"

    // conversa + memória
    const conv = await getOrCreateConversation(teacherId)
    const recent = await loadRecentMessages(conv.id, 30)

    const system = buildSystemPrompt({ mode, locale, aiName })

    const messages: { role: Role; content: string }[] = [{ role: "system", content: system }]

    if (conv.summary && conv.summary.trim().length > 0) {
      messages.push({
        role: "system",
        content: `Memória (resumo da conversa até aqui):\n${conv.summary}`,
      })
    }

    for (const m of recent) messages.push(m)

    messages.push({ role: "user", content: message })

    await db`
      INSERT INTO ai_messages (conversation_id, role, content)
      VALUES (${conv.id}, 'user', ${message})
    `

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages,
    })

    const text = completion.choices?.[0]?.message?.content?.trim() ?? ""

    await db`
      INSERT INTO ai_messages (conversation_id, role, content)
      VALUES (${conv.id}, 'assistant', ${text})
    `

    await maybeUpdateSummary(conv.id)

    return NextResponse.json({ text })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
