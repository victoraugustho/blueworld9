"use client"

import { useMemo } from "react"
import { Lightbulb, MessageSquareText, ClipboardList, GraduationCap } from "lucide-react"

type Locale = "pt-BR" | "es"

export function AIProfessorTips({ locale = "pt-BR" }: { locale?: Locale }) {
  const t = useMemo(() => {
    const isES = locale === "es"
    return {
      title: isES ? "Sugerencias para el profesor" : "Dicas para o professor",
      subtitle: isES
        ? "Usa el chat para planificar clases, adaptar actividades y crear materiales. (Solo conversación: no ejecuta acciones.)"
        : "Use o chat para planejar aulas, adaptar atividades e criar materiais. (Só conversa: não executa ações.)",
      tips: isES
        ? [
            { icon: ClipboardList, title: "Plan de clase rápido", text: "Pide un plan de 45–60 min con objetivo, etapas y actividad sin pantallas." },
            { icon: GraduationCap, title: "Adaptar por serie", text: "Dile el año/tema y pide 3 niveles: básico, medio, avanzado." },
            { icon: MessageSquareText, title: "Explicación + ejemplo", text: "Pide una explicación simple y un ejemplo cotidiano para el aula." },
            { icon: Lightbulb, title: "Actividad práctica", text: "Pide una dinámica con papel/pizarra, con tiempo y criterios de evaluación." },
          ]
        : [
            { icon: ClipboardList, title: "Plano de aula rápido", text: "Peça um plano de 45–60 min com objetivo, etapas e atividade sem telas." },
            { icon: GraduationCap, title: "Adaptar por série", text: "Informe ano/tema e peça 3 níveis: básico, médio, avançado." },
            { icon: MessageSquareText, title: "Explicação + exemplo", text: "Peça uma explicação simples e um exemplo do dia a dia pra sala." },
            { icon: Lightbulb, title: "Atividade prática", text: "Peça uma dinâmica com papel/quadro, com tempo e critérios de avaliação." },
          ],
      example: isES ? "Ejemplo de pedido:" : "Exemplo de pedido:",
      prompt: isES
        ? "“Soy profesor de 9º. Tema: algoritmos sin programación y sin pantallas. Crea un plan de clase de 50 min con actividad práctica, materiales necesarios, tiempo por etapa y un criterio de evaluación.”"
        : "“Sou professor do 9º ano. Tema: algoritmos sem programação e sem telas. Crie um plano de aula de 50 min com atividade prática, materiais necessários, tempo por etapa e um critério de avaliação.”",
    }
  }, [locale])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-5 h-5 text-yellow-300" />
        <h2 className="text-white font-semibold">{t.title}</h2>
      </div>

      <p className="text-slate-300 text-sm mb-4">{t.subtitle}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {t.tips.map((tip, i) => {
          const Icon = tip.icon
          return (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-slate-900/20 p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-cyan-300" />
                <div className="text-white font-medium text-sm">{tip.title}</div>
              </div>
              <div className="text-slate-300 text-sm">{tip.text}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/20 p-4">
        <div className="text-xs text-slate-400 mb-2">{t.example}</div>
        <div className="text-sm text-white whitespace-pre-wrap">{t.prompt}</div>
      </div>
    </div>
  )
}
